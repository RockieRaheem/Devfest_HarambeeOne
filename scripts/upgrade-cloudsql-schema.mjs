import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
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
const backendRoot = path.join(repositoryRoot, "apps", "backend");

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
  for (const required of ["instance", "database", "user", "runtime-role"]) {
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

function renderUpgrade(fromRevision, runtimeRole) {
  if (!/^[a-f0-9]{12}$/.test(fromRevision)) throw new Error("Invalid current Alembic revision");
  const command = process.platform === "win32" ? "uv.exe" : "uv";
  const result = spawnSync(
    command,
    [
      "--cache-dir", ".cache/uv", "run", "--no-sync", "python", "-m", "alembic",
      "upgrade", `${fromRevision}:head`, "--sql",
    ],
    { cwd: backendRoot, encoding: "utf8", env: process.env, maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(`Alembic SQL generation failed: ${result.stderr.trim()}`);
  const sql = result.stdout
    .replace(/\bauth\.users\b/gi, "public.firebase_legacy_auth_users")
    .replace(/\bauth\.uid\(\)/gi, "public.firebase_legacy_uid()")
    .replace(/\bPUBLIC\s*,\s*anon\s*,\s*authenticated\b/gi, "PUBLIC")
    .replace(/\banon\s*,\s*authenticated\b/gi, "PUBLIC")
    .replace(/\bauthenticated\b/gi, identifier(runtimeRole));
  if (/\b(?:anon|authenticated)\b/i.test(sql)) {
    throw new Error("Generated SQL still contains an unmapped Supabase database role");
  }
  const revisionMatches = [...sql.matchAll(/version_num='([a-f0-9]{12})'/g)];
  const revision = revisionMatches.at(-1)?.[1];
  if (!revision || revision === fromRevision) throw new Error("No reviewed schema upgrade was rendered");
  return { sql, revision };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const database = validateIdentifier(options.database, "Database");
  const runtimeRole = validateIdentifier(options["runtime-role"], "Runtime role");
  if (!/^[\w.-]+:[\w-]+:[\w-]+$/.test(options.instance)) throw new Error("Invalid instance name");
  if (!options.user.includes("@")) throw new Error("User must be an IAM account email");
  const account = firebaseAuth.getGlobalDefaultAccount();
  if (!account || account.user.email !== options.user) {
    throw new Error(`Firebase CLI must be signed in as ${options.user}`);
  }
  firebaseAuth.setActiveAccount({}, account);

  const connector = new Connector({ auth: new FBToolsAuthClient() });
  const connectionOptions = await connector.getOptions({
    instanceConnectionName: options.instance,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  });
  const pool = new Pool({ ...connectionOptions, user: options.user, database, max: 1 });
  let client;
  let ownerRole;
  let temporaryGrant = false;
  try {
    client = await pool.connect();
    const ownerRoles = (await client.query(
      "select rolname from pg_roles where rolname like 'firebaseowner\\_%' escape '\\' order by rolname",
    )).rows.map(({ rolname }) => rolname);
    if (ownerRoles.length !== 1) throw new Error("Expected exactly one Firebase schema-owner role");
    [ownerRole] = ownerRoles;
    validateIdentifier(ownerRole, "Detected owner role");
    const current = (await client.query("select version_num from public.alembic_version")).rows;
    if (current.length !== 1) throw new Error("Expected exactly one current Alembic revision");
    const upgrade = renderUpgrade(current[0].version_num, runtimeRole);
    const priorMembership = (await client.query(
      "select pg_has_role($1, $2, 'member') as member", [options.user, ownerRole],
    )).rows[0].member;
    if (!priorMembership) {
      throw new Error(
        "Operator lacks the temporary owner role; grant it with Firebase "
        + "dataconnect:sql:grant before running this command",
      );
    }
    temporaryGrant = true;
    await client.query(`SET ROLE ${identifier(ownerRole)}`);
    await client.query(upgrade.sql);
    await client.query("RESET ROLE");
    if (temporaryGrant) {
      await client.query(`REVOKE ${identifier(ownerRole)} FROM ${identifier(options.user)}`);
      temporaryGrant = false;
    }
    const revision = (await client.query("select version_num from public.alembic_version"))
      .rows[0]?.version_num;
    const retainedOwner = (await client.query(
      "select pg_has_role($1, $2, 'member') as member", [options.user, ownerRole],
    )).rows[0].member;
    if (revision !== upgrade.revision || retainedOwner) {
      throw new Error("Schema revision or temporary owner revocation verification failed");
    }
    console.log(`Cloud SQL schema upgraded to Alembic revision ${revision}; owner access revoked.`);
  } finally {
    if (client && temporaryGrant && ownerRole) {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.query("RESET ROLE").catch(() => undefined);
      await client.query(`REVOKE ${identifier(ownerRole)} FROM ${identifier(options.user)}`)
        .catch(() => undefined);
    }
    client?.release();
    await pool.end().catch(() => undefined);
    connector.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
