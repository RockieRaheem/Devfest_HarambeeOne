import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
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
  for (const required of ["instance", "database", "user", "owner-role", "runtime-role"]) {
    if (!values.has(required)) {
      throw new Error(`Missing required argument: --${required}`);
    }
  }
  return Object.fromEntries(values);
}

function validateIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${label} is not a safe PostgreSQL identifier`);
  }
  return value;
}

function renderMigrations(runtimeRole) {
  const command = process.platform === "win32" ? "uv.exe" : "uv";
  const result = spawnSync(
    command,
    ["--cache-dir", ".cache/uv", "run", "--no-sync", "python", "-m", "alembic", "upgrade", "head", "--sql"],
    {
      cwd: backendRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Alembic SQL generation failed:\n${result.stderr.trim()}`);
  }
  if (!result.stdout.includes("CREATE TABLE alembic_version")) {
    throw new Error("Alembic did not produce a full migration chain");
  }
  const sql = result.stdout
    .replace(/\bauth\.users\b/gi, "public.firebase_legacy_auth_users")
    .replace(/\bauth\.uid\(\)/gi, "public.firebase_legacy_uid()")
    .replace(/\bPUBLIC\s*,\s*anon\s*,\s*authenticated\b/gi, "PUBLIC")
    .replace(/\banon\s*,\s*authenticated\b/gi, "PUBLIC")
    .replace(/\bauthenticated\b/gi, `"${runtimeRole}"`);
  if (/\b(?:anon|authenticated)\b/i.test(sql)) {
    throw new Error("Generated SQL still contains an unmapped Supabase database role");
  }
  return sql;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const database = validateIdentifier(options.database, "Database");
  const ownerRole = validateIdentifier(options["owner-role"], "Owner role");
  const runtimeRole = validateIdentifier(options["runtime-role"], "Runtime role");
  if (!/^[\w.-]+:[\w-]+:[\w-]+$/.test(options.instance)) {
    throw new Error("Instance must be a Cloud SQL connection name");
  }
  if (!options.user.includes("@")) {
    throw new Error("User must be the explicitly granted IAM account email");
  }
  const account = firebaseAuth.getProjectDefaultAccount(repositoryRoot);
  if (!account || account.user.email !== options.user) {
    throw new Error(`Firebase CLI must be signed in as ${options.user}`);
  }
  firebaseAuth.setActiveAccount({}, account);

  const [bootstrapSql, migrationSql] = await Promise.all([
    readFile(path.join(backendRoot, "cloudsql", "bootstrap.sql"), "utf8"),
    Promise.resolve(renderMigrations(runtimeRole)),
  ]);
  const connector = new Connector({ auth: new FBToolsAuthClient() });
  const clientOptions = await connector.getOptions({
    instanceConnectionName: options.instance,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  });
  const pool = new Pool({ ...clientOptions, user: options.user, database });
  let client;
  try {
    client = await pool.connect();
    const existing = await client.query(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );
    const unexpected = existing.rows
      .map((row) => row.tablename)
      .filter((table) => table !== "firebase_legacy_auth_users");
    if (unexpected.length > 0) {
      throw new Error(
        `Refusing a non-empty target; found public tables: ${unexpected.join(", ")}`,
      );
    }
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await client.query(`SET ROLE "${ownerRole}"`);
    await client.query("DROP TABLE IF EXISTS public.firebase_legacy_auth_users");
    await client.query(bootstrapSql);
    await client.query(
      `GRANT EXECUTE ON FUNCTION public.firebase_legacy_uid() TO "${runtimeRole}"`,
    );
    await client.query(migrationSql);
    await client.query("DROP TABLE public.firebase_legacy_auth_users");
    const result = await client.query(
      "select version_num from public.alembic_version",
    );
    if (result.rows.length !== 1) {
      throw new Error("Expected exactly one Alembic revision after migration");
    }
    console.log(`Cloud SQL schema applied at Alembic revision ${result.rows[0].version_num}.`);
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
    connector.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
