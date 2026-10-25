import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const firebasePackage = require.resolve("firebase-tools/package.json");
const firebaseRequire = createRequire(firebasePackage);
const { AuthTypes, Connector, IpAddressTypes } = firebaseRequire(
  "@google-cloud/cloud-sql-connector",
);
const { Pool } = firebaseRequire("pg");
const firebaseRoot = path.dirname(firebasePackage);
const { FBToolsAuthClient } = require(
  path.join(firebaseRoot, "lib/gcp/cloudsql/fbToolsAuthClient.js"),
);
const firebaseAuth = require(path.join(firebaseRoot, "lib/auth.js"));
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArguments(argv) {
  argv = argv.filter((argument) => argument !== "--");
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Expected --name value arguments; received ${key ?? "nothing"}`);
    }
    values.set(key.slice(2), value);
  }
  for (const required of ["instance", "database", "user", "owner-role", "evidence-dir"]) {
    if (!values.has(required)) throw new Error(`Missing required argument: --${required}`);
  }
  return Object.fromEntries(values);
}

function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function validateIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${label} is not a safe PostgreSQL identifier`);
  }
  return value;
}

function canonical(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { base64: value.toString("base64") };
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return String(value);
}

async function tableMetadata(client) {
  const tables = (await client.query(
    "select tablename from pg_tables where schemaname = 'public' and tablename <> 'alembic_version' order by tablename",
  )).rows.map((row) => row.tablename);
  const metadata = new Map();
  for (const table of tables) {
    const columns = (await client.query(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = $1 order by ordinal_position`,
      [table],
    )).rows;
    const primaryKey = (await client.query(
      `select attribute.attname as column_name
       from pg_index index
       join pg_class relation on relation.oid = index.indrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
       join unnest(index.indkey) with ordinality keys(attnum, position) on true
       join pg_attribute attribute on attribute.attrelid = relation.oid and attribute.attnum = keys.attnum
       where namespace.nspname = 'public' and relation.relname = $1 and index.indisprimary
       order by keys.position`,
      [table],
    )).rows.map((row) => row.column_name);
    metadata.set(table, { columns, primaryKey });
  }
  return metadata;
}

async function orderedTables(client, metadata) {
  const dependencies = new Map([...metadata.keys()].map((table) => [table, new Set()]));
  const rows = (await client.query(
    `select child.relname as child, parent.relname as parent
     from pg_constraint fk
     join pg_class child on child.oid = fk.conrelid
     join pg_namespace child_namespace on child_namespace.oid = child.relnamespace
     join pg_class parent on parent.oid = fk.confrelid
     join pg_namespace parent_namespace on parent_namespace.oid = parent.relnamespace
     where fk.contype = 'f' and child_namespace.nspname = 'public'
       and parent_namespace.nspname = 'public'`,
  )).rows;
  for (const { child, parent } of rows) {
    if (child !== parent && dependencies.has(child) && dependencies.has(parent)) {
      dependencies.get(child).add(parent);
    }
  }
  const ordered = [];
  while (ordered.length < dependencies.size) {
    const ready = [...dependencies]
      .filter(([table, parents]) => !ordered.includes(table) && [...parents].every((parent) => ordered.includes(parent)))
      .map(([table]) => table)
      .sort();
    if (ready.length === 0) throw new Error("Foreign-key dependency cycle requires a reviewed copy order");
    ordered.push(...ready);
  }
  return ordered;
}

async function captureEvidence(client, metadata) {
  const revision = (await client.query("select version_num from public.alembic_version")).rows[0]?.version_num;
  const tables = {};
  for (const [table, details] of metadata) {
    const order = details.primaryKey.length > 0
      ? ` order by ${details.primaryKey.map(identifier).join(", ")}`
      : ` order by ${details.columns.map(({ column_name }) => identifier(column_name)).join(", ")}`;
    const rows = (await client.query(`select * from public.${identifier(table)}${order}`)).rows;
    const hash = createHash("sha256");
    for (const row of rows) {
      const encoded = Buffer.from(JSON.stringify(details.columns.map(({ column_name }) => canonical(row[column_name]))));
      const length = Buffer.alloc(8);
      length.writeBigUInt64BE(BigInt(encoded.length));
      hash.update(length);
      hash.update(encoded);
    }
    const numericTotals = {};
    for (const { column_name, data_type } of details.columns) {
      if (["numeric", "decimal"].includes(data_type)) {
        const result = await client.query(
          `select coalesce(sum(${identifier(column_name)}), 0)::text as total from public.${identifier(table)}`,
        );
        numericTotals[column_name] = result.rows[0].total;
      }
    }
    tables[table] = { rows: rows.length, sha256: hash.digest("hex"), numeric_totals: numericTotals };
  }
  return { revision, tables };
}

function compareEvidence(source, target) {
  const errors = [];
  if (source.revision !== target.revision) errors.push("Alembic revisions differ");
  const sourceTables = Object.keys(source.tables);
  const targetTables = Object.keys(target.tables);
  if (JSON.stringify(sourceTables) !== JSON.stringify(targetTables)) errors.push("Table sets differ");
  for (const table of sourceTables) {
    if (JSON.stringify(source.tables[table]) !== JSON.stringify(target.tables[table])) {
      errors.push(`Evidence differs for ${table}`);
    }
  }
  return errors;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const database = validateIdentifier(options.database, "Database");
  const ownerRole = validateIdentifier(options["owner-role"], "Owner role");
  if (!/^[\w.-]+:[\w-]+:[\w-]+$/.test(options.instance)) throw new Error("Invalid instance name");
  if (!options.user.includes("@")) throw new Error("User must be an IAM account email");
  process.loadEnvFile(path.join(repositoryRoot, ".env"));
  const sourceUrl = process.env.MIGRATION_DATABASE_URL?.replace("postgresql+psycopg://", "postgresql://");
  if (!sourceUrl) throw new Error("MIGRATION_DATABASE_URL is missing");
  const account = firebaseAuth.getProjectDefaultAccount(repositoryRoot);
  if (!account || account.user.email !== options.user) {
    throw new Error(`Firebase CLI must be signed in as ${options.user}`);
  }
  firebaseAuth.setActiveAccount({}, account);

  const connector = new Connector({ auth: new FBToolsAuthClient() });
  const targetOptions = await connector.getOptions({
    instanceConnectionName: options.instance,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  });
  const sourcePool = new Pool({ connectionString: sourceUrl, max: 1 });
  const targetPool = new Pool({ ...targetOptions, user: options.user, database, max: 1 });
  let source;
  let target;
  try {
    source = await sourcePool.connect();
    target = await targetPool.connect();
    await source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await target.query(`SET ROLE "${ownerRole}"`);
    const sourceMetadata = await tableMetadata(source);
    const targetMetadata = await tableMetadata(target);
    if (JSON.stringify([...sourceMetadata.keys()]) !== JSON.stringify([...targetMetadata.keys()])) {
      throw new Error("Source and target table sets differ before migration");
    }
    const sourceRevision = (await source.query("select version_num from alembic_version")).rows[0].version_num;
    const targetRevision = (await target.query("select version_num from alembic_version")).rows[0].version_num;
    if (sourceRevision !== targetRevision) throw new Error("Source and target Alembic revisions differ");
    for (const table of targetMetadata.keys()) {
      const result = await target.query(`select count(*)::bigint as rows from public.${identifier(table)}`);
      if (BigInt(result.rows[0].rows) !== 0n) throw new Error(`Target table ${table} is not empty`);
    }
    const ordered = await orderedTables(source, sourceMetadata);
    const sourceEvidence = await captureEvidence(source, sourceMetadata);
    let targetEvidence;
    await target.query("BEGIN");
    try {
      for (const table of ordered) {
        await target.query(`ALTER TABLE public.${identifier(table)} DISABLE TRIGGER USER`);
      }
      for (const table of ordered) {
        const details = sourceMetadata.get(table);
        const rows = (await source.query(`select * from public.${identifier(table)}`)).rows;
        if (rows.length === 0) continue;
        const columns = details.columns.map(({ column_name }) => column_name);
        for (const row of rows) {
          const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
          await target.query(
            `insert into public.${identifier(table)} (${columns.map(identifier).join(", ")}) values (${placeholders})`,
            columns.map((column) => row[column]),
          );
        }
      }
      for (const table of ordered) {
        await target.query(`ALTER TABLE public.${identifier(table)} ENABLE TRIGGER USER`);
      }
      targetEvidence = await captureEvidence(target, targetMetadata);
      const errors = compareEvidence(sourceEvidence, targetEvidence);
      if (errors.length > 0) throw new Error(`Database parity failed: ${errors.join("; ")}`);
      await target.query("COMMIT");
    } catch (error) {
      await target.query("ROLLBACK");
      throw error;
    }
    const evidenceDirectory = path.resolve(repositoryRoot, options["evidence-dir"]);
    await mkdir(evidenceDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(evidenceDirectory, "source.json"), `${JSON.stringify(sourceEvidence, null, 2)}\n`),
      writeFile(path.join(evidenceDirectory, "target.json"), `${JSON.stringify(targetEvidence, null, 2)}\n`),
    ]);
    const rowCount = Object.values(sourceEvidence.tables).reduce((total, table) => total + table.rows, 0);
    console.log(`Database parity passed for ${sourceMetadata.size} tables and ${rowCount} rows.`);
  } finally {
    await source?.query("ROLLBACK").catch(() => undefined);
    source?.release();
    target?.release();
    await Promise.all([sourcePool.end().catch(() => undefined), targetPool.end().catch(() => undefined)]);
    connector.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
