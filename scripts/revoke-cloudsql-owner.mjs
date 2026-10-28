import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

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

function argumentsByName(argv) {
  const values = new Map();
  argv = argv.filter((argument) => argument !== "--");
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Expected --name value arguments; received ${key ?? "nothing"}`);
    }
    values.set(key.slice(2), value);
  }
  for (const required of ["instance", "database", "user", "writer-role"]) {
    if (!values.has(required)) throw new Error(`Missing required argument: --${required}`);
  }
  return Object.fromEntries(values);
}

function safeIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`${label} is not a safe PostgreSQL identifier`);
  }
  return value;
}

async function main() {
  const options = argumentsByName(process.argv.slice(2));
  const database = safeIdentifier(options.database, "Database");
  const writerRole = safeIdentifier(options["writer-role"], "Writer role");
  if (!options.user.includes("@")) throw new Error("User must be an IAM account email");
  if (!/^[\w.-]+:[\w-]+:[\w-]+$/.test(options.instance)) throw new Error("Invalid instance name");

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
  const pool = new Pool({ ...connectionOptions, user: options.user, database });
  let client;
  try {
    client = await pool.connect();
    const ownerRoles = (await client.query(
      "select rolname from pg_roles where rolname like 'firebaseowner\\_%' escape '\\' order by rolname",
    )).rows.map(({ rolname }) => rolname);
    if (ownerRoles.length !== 1) throw new Error("Expected exactly one Firebase schema-owner role");
    const ownerRole = safeIdentifier(ownerRoles[0], "Detected owner role");
    const heldOwner = (await client.query(
      "select pg_has_role($1, $2, 'member') as owner",
      [options.user, ownerRole],
    )).rows[0].owner;
    if (heldOwner) {
      await client.query(`REVOKE "${ownerRole}" FROM "${options.user}"`);
    }
    const access = (await client.query(
      "select pg_has_role($1, $2, 'member') as owner, pg_has_role($1, $3, 'member') as writer",
      [options.user, ownerRole, writerRole],
    )).rows[0];
    if (access.owner || !access.writer) {
      throw new Error("Least-privilege downgrade verification failed");
    }
    console.log("Temporary schema-owner membership revoked; writer membership verified.");
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
