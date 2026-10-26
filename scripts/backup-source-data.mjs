import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const firebasePackage = require.resolve("firebase-tools/package.json");
const firebaseRequire = createRequire(firebasePackage);
const { Pool } = firebaseRequire("pg");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const magic = Buffer.from("H1BACK01", "ascii");

function parseArguments(argv) {
  argv = argv.filter((argument) => argument !== "--");
  const command = argv.shift();
  if (!["create", "verify"].includes(command)) {
    throw new Error("Usage: backup-source-data.mjs <create|verify> --artifact PATH --key-file PATH");
  }
  const values = { command };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Expected --name value arguments; received ${key ?? "nothing"}`);
    }
    values[key.slice(2)] = value;
  }
  for (const required of ["artifact", "key-file"]) {
    if (!values[required]) throw new Error(`Missing required argument: --${required}`);
  }
  return values;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function encode(value) {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return value;
  if (typeof value === "bigint") return { $type: "bigint", value: value.toString() };
  if (value instanceof Date) return { $type: "date", value: value.toISOString() };
  if (Buffer.isBuffer(value)) return { $type: "bytes", value: value.toString("base64") };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  }
  throw new Error(`Unsupported backup value type: ${typeof value}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function loadOrCreateKey(keyPath, create) {
  if (isInside(repositoryRoot, keyPath)) {
    throw new Error("The encryption key must be stored outside the repository");
  }
  if (create) {
    await mkdir(path.dirname(keyPath), { recursive: true });
    try {
      await writeFile(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  const key = await readFile(keyPath);
  if (key.length !== 32) throw new Error("Backup key must contain exactly 32 random bytes");
  return key;
}

async function applicationTables(client) {
  const names = (await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  )).rows.map(({ tablename }) => tablename);
  const tables = [];
  for (const name of names) {
    const columns = (await client.query(
      `select column_name, data_type, udt_name from information_schema.columns
       where table_schema = 'public' and table_name = $1 order by ordinal_position`,
      [name],
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
      [name],
    )).rows.map(({ column_name }) => column_name);
    const orderColumns = primaryKey.length > 0
      ? primaryKey
      : columns.map(({ column_name }) => column_name);
    const rows = (await client.query(
      `select * from public.${identifier(name)} order by ${orderColumns.map(identifier).join(", ")}`,
    )).rows.map(encode);
    tables.push({ name, columns, primary_key: primaryKey, rows });
  }
  return tables;
}

async function authTables(client) {
  const result = [];
  for (const name of ["users", "identities"]) {
    const columns = (await client.query(
      `select column_name, data_type, udt_name from information_schema.columns
       where table_schema = 'auth' and table_name = $1 order by ordinal_position`,
      [name],
    )).rows;
    if (columns.length === 0) throw new Error(`Required Supabase Auth table auth.${name} is missing`);
    const rows = (await client.query(
      `select * from auth.${identifier(name)} order by id`,
    )).rows.map(encode);
    result.push({ name, columns, rows });
  }
  return result;
}

function validatePayload(payload) {
  if (payload?.format !== "harambeeone-source-backup-v1") throw new Error("Unsupported backup format");
  if (!Array.isArray(payload.application_tables) || !Array.isArray(payload.auth_tables)) {
    throw new Error("Backup table collections are invalid");
  }
  const authNames = payload.auth_tables.map(({ name }) => name).sort();
  if (JSON.stringify(authNames) !== JSON.stringify(["identities", "users"])) {
    throw new Error("Backup does not contain both required Auth tables");
  }
  for (const table of [...payload.application_tables, ...payload.auth_tables]) {
    if (!table.name || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      throw new Error("Backup contains an invalid table record");
    }
  }
}

async function createBackup(artifactPath, keyPath) {
  process.loadEnvFile(path.join(repositoryRoot, ".env"));
  const sourceUrl = process.env.MIGRATION_DATABASE_URL?.replace(
    "postgresql+psycopg://",
    "postgresql://",
  );
  if (!sourceUrl) throw new Error("MIGRATION_DATABASE_URL is missing");
  const key = await loadOrCreateKey(keyPath, true);
  const pool = new Pool({ connectionString: sourceUrl, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const payload = {
      format: "harambeeone-source-backup-v1",
      created_at: new Date().toISOString(),
      database_revision: (await client.query("select version_num from public.alembic_version"))
        .rows[0]?.version_num,
      application_tables: await applicationTables(client),
      auth_tables: await authTables(client),
    };
    validatePayload(payload);
    const plaintext = Buffer.from(JSON.stringify(payload));
    const compressed = gzipSync(plaintext, { level: 9 });
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const tag = cipher.getAuthTag();
    const artifact = Buffer.concat([magic, iv, tag, ciphertext]);
    const temporaryPath = `${artifactPath}.tmp`;
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(temporaryPath, artifact, { flag: "wx" });
    await rename(temporaryPath, artifactPath);
    const manifest = {
      format: payload.format,
      created_at: payload.created_at,
      database_revision: payload.database_revision,
      encryption: "AES-256-GCM",
      artifact_sha256: sha256(artifact),
      application_tables: payload.application_tables.length,
      application_rows: payload.application_tables.reduce((sum, table) => sum + table.rows.length, 0),
      auth_users: payload.auth_tables.find(({ name }) => name === "users").rows.length,
      auth_identities: payload.auth_tables.find(({ name }) => name === "identities").rows.length,
    };
    await writeFile(`${artifactPath}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    console.log(
      `Encrypted source backup created: ${manifest.application_tables} application tables, `
      + `${manifest.application_rows} application rows, ${manifest.auth_users} Auth users, `
      + `${manifest.auth_identities} Auth identities.`,
    );
  } finally {
    await client?.query("ROLLBACK").catch(() => undefined);
    client?.release();
    await pool.end().catch(() => undefined);
  }
}

async function verifyBackup(artifactPath, keyPath) {
  const key = await loadOrCreateKey(keyPath, false);
  const artifact = await readFile(artifactPath);
  if (artifact.length < 36 || !artifact.subarray(0, 8).equals(magic)) {
    throw new Error("Backup header is invalid");
  }
  const iv = artifact.subarray(8, 20);
  const tag = artifact.subarray(20, 36);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const compressed = Buffer.concat([decipher.update(artifact.subarray(36)), decipher.final()]);
  const payload = JSON.parse(gunzipSync(compressed).toString("utf8"));
  validatePayload(payload);
  const manifest = JSON.parse(await readFile(`${artifactPath}.manifest.json`, "utf8"));
  if (manifest.artifact_sha256 !== sha256(artifact)) throw new Error("Backup manifest hash mismatch");
  const actual = {
    application_tables: payload.application_tables.length,
    application_rows: payload.application_tables.reduce((sum, table) => sum + table.rows.length, 0),
    auth_users: payload.auth_tables.find(({ name }) => name === "users").rows.length,
    auth_identities: payload.auth_tables.find(({ name }) => name === "identities").rows.length,
  };
  for (const [name, value] of Object.entries(actual)) {
    if (manifest[name] !== value) throw new Error(`Backup manifest ${name} does not match`);
  }
  console.log(
    `Encrypted source backup verified: ${actual.application_tables} application tables, `
    + `${actual.application_rows} application rows, ${actual.auth_users} Auth users, `
    + `${actual.auth_identities} Auth identities.`,
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const artifactPath = path.resolve(repositoryRoot, options.artifact);
  const keyPath = path.resolve(options["key-file"]);
  if (options.command === "create") {
    for (const candidate of [artifactPath, `${artifactPath}.manifest.json`]) {
      try {
        await stat(candidate);
        throw new Error("Refusing to overwrite an existing backup artifact or manifest");
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    const lockPath = `${artifactPath}.lock`;
    await mkdir(path.dirname(artifactPath), { recursive: true });
    try {
      await writeFile(lockPath, String(process.pid), { flag: "wx" });
    } catch (error) {
      if (error?.code === "EEXIST") throw new Error("Another backup creation is already running");
      throw error;
    }
    try {
      await createBackup(artifactPath, keyPath);
    } finally {
      await unlink(lockPath).catch(() => undefined);
    }
  } else {
    await verifyBackup(artifactPath, keyPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
