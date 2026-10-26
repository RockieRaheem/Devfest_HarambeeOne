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

const tenantTables = [
  "academic_years", "academic_periods", "school_memberships", "academic_classes", "streams",
  "students", "enrollments", "guardian_links", "fee_structures", "fee_categories",
  "student_fee_assignments", "requirements", "student_requirements", "payments",
  "payment_allocations", "billing_publications", "billing_adjustments", "ledger_entries",
  "arrears_follow_ups", "arrears_payment_promises", "statement_imports",
  "statement_transactions", "cashier_collection_batches", "cashier_batch_payments",
  "period_closes", "period_close_learners", "balance_carry_forwards",
  "balance_carry_forward_lines", "learner_rollovers", "learner_rollover_lines",
  "period_reopenings", "period_reopening_corrections", "period_reopening_learners",
  "audit_events",
];
const retryConstraints = [
  "uq_billing_publication_key", "uq_payment_correction_key", "uq_statement_import_key",
  "uq_period_closes_key", "uq_balance_carry_key", "uq_learner_rollovers_key",
  "uq_period_reopenings_key",
];
const immutableTriggers = [
  "ledger_entries_immutable", "statement_import_source_immutable",
  "statement_transaction_source_immutable", "protect_period_close_snapshot",
  "protect_period_close_learner_snapshot", "protect_balance_carry_batch",
  "protect_balance_carry_line", "protect_learner_rollover_batch",
  "protect_learner_rollover_line", "protect_period_reopenings",
  "protect_period_reopening_corrections", "protect_period_reopening_learners",
];

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
  for (const required of ["instance", "database", "user", "owner-role", "writer-role"]) {
    if (!values.has(required)) throw new Error(`Missing required argument: --${required}`);
  }
  return Object.fromEntries(values);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function count(client, sql, values = []) {
  return Number((await client.query(sql, values)).rows[0].count);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.user.includes("@")) throw new Error("User must be an IAM account email");
  if (options["runtime-user"] && !options["runtime-user"].includes("@")) {
    throw new Error("Runtime user must be an IAM database username");
  }
  if (!/^[\w.-]+:[\w-]+:[\w-]+$/.test(options.instance)) throw new Error("Invalid instance name");
  for (const key of ["database", "owner-role", "writer-role"]) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(options[key])) {
      throw new Error(`${key} is not a safe PostgreSQL identifier`);
    }
  }
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
  const pool = new Pool({
    ...connectionOptions,
    user: options.user,
    database: options.database,
    max: 1,
  });
  let client;
  try {
    client = await pool.connect();
    const revision = (await client.query("select version_num from alembic_version")).rows[0]?.version_num;
    assert(revision === "a8c4e2f19b70", `Unexpected Alembic revision: ${revision}`);

    const aiConsentColumns = (await client.query(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and table_name = any($1::text[])
         and column_name = any($2::text[])
       order by table_name, column_name`,
      [["support_consents", "support_referrals"], ["gemini_processing", "gemma_processing"]],
    )).rows;
    assert(
      JSON.stringify(aiConsentColumns) === JSON.stringify([
        { table_name: "support_consents", column_name: "gemini_processing" },
        { table_name: "support_referrals", column_name: "gemini_processing" },
      ]),
      "Gemini consent columns do not match the reviewed schema",
    );

    const access = (await client.query(
      "select pg_has_role($1, $2, 'member') as owner, pg_has_role($1, $3, 'member') as writer",
      [options.user, options["owner-role"], options["writer-role"]],
    )).rows[0];
    assert(access.owner === false, "Operator still holds schema-owner membership");
    assert(access.writer === true, "Operator does not hold controlled writer membership");

    if (options["runtime-user"]) {
      const runtimeAccess = (await client.query(
        "select pg_has_role($1, $2, 'member') as owner, pg_has_role($1, $3, 'member') as writer",
        [options["runtime-user"], options["owner-role"], options["writer-role"]],
      )).rows[0];
      assert(runtimeAccess.owner === false, "Runtime identity holds schema-owner membership");
      assert(runtimeAccess.writer === true, "Runtime identity lacks controlled writer membership");
      const runtimeRole = (await client.query(
        "select rolbypassrls from pg_roles where rolname = $1",
        [options["runtime-user"]],
      )).rows[0];
      assert(runtimeRole?.rolbypassrls === false, "Runtime login unexpectedly bypasses RLS");
    }

    const role = (await client.query(
      "select rolbypassrls from pg_roles where rolname = $1",
      [options["writer-role"]],
    )).rows[0];
    assert(role?.rolbypassrls === true, "Firebase writer-role behavior changed; review access model");
    const loginRole = (await client.query(
      "select current_user, rolbypassrls from pg_roles where rolname = current_user",
    )).rows[0];
    assert(loginRole.current_user === options.user, "Unexpected effective database login role");
    assert(loginRole.rolbypassrls === false, "IAM login unexpectedly bypasses row-level security");

    const rlsTables = (await client.query(
      `select relation.relname
       from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public' and relation.relrowsecurity
         and relation.relname = any($1::text[])`,
      [tenantTables],
    )).rows.map((row) => row.relname);
    assert(rlsTables.length === tenantTables.length, "A required tenant table is missing RLS");

    const constraints = (await client.query(
      "select conname from pg_constraint where conname = any($1::text[]) and convalidated",
      [retryConstraints],
    )).rows.map((row) => row.conname);
    assert(constraints.length === retryConstraints.length, "A retry-safety constraint is missing");

    const triggers = (await client.query(
      `select trigger_record.tgname
       from pg_trigger trigger_record join pg_class relation on relation.oid = trigger_record.tgrelid
       join pg_namespace namespace on namespace.oid = relation.relnamespace
       where not trigger_record.tgisinternal and namespace.nspname = 'public'
         and trigger_record.tgname = any($1::text[]) and trigger_record.tgenabled <> 'D'`,
      [immutableTriggers],
    )).rows.map((row) => row.tgname);
    assert(triggers.length === immutableTriggers.length, "An immutable-evidence trigger is missing");

    assert(await count(client,
      `select count(*) from period_close_learners
       where opening_balance + net_assessed - net_collected <> closing_balance
          or greatest(closing_balance, 0) <> outstanding
          or greatest(-closing_balance, 0) <> credit_balance`,
    ) === 0, "A sealed learner balance fails its financial equation");
    assert(await count(client,
      `select count(*) from audit_events where actor is null or btrim(actor) = ''`,
    ) === 0, "Consequential audit evidence is missing an actor");
    assert(await count(client,
      `select count(*) from pg_index where not indisvalid or not indisready`,
    ) === 0, "Cloud SQL contains an invalid or unready index");
    assert(await count(client,
      `select count(*) from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'PUBLIC'`,
    ) === 0, "A public table grant exposes application data");

    assert(await count(client, "select count(*) from schools") === 0,
      "An IAM writer member can read tenant rows without an authenticated database subject");
    assert(await count(client, "select count(*) from ledger_entries") === 0,
      "An IAM writer member can read ledger rows without an authenticated database subject");

    await client.query("begin");
    await client.query(`set local role "${options["writer-role"]}"`);
    const ledger = (await client.query("select id from ledger_entries order by id limit 1")).rows[0];
    assert(ledger, "Expected migrated ledger evidence for immutability verification");
    let immutable = false;
    try {
      await client.query("update ledger_entries set description = description where id = $1", [ledger.id]);
    } catch (error) {
      immutable = error?.code === "P0001" || String(error?.message).toLowerCase().includes("immutable");
    } finally {
      await client.query("rollback");
    }
    assert(immutable, "Ledger immutability trigger did not reject an update");

    console.log(
      "Cloud SQL controls passed: revision, least privilege, RLS metadata, retry constraints, " +
      "no-context tenant denial, immutability, financial equations, audit actors, indexes, " +
      "runtime role, and public grants.",
    );
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
