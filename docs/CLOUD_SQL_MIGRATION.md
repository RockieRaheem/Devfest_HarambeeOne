# Cloud SQL migration runbook

This runbook implements Slice F3's rehearsal-first, single-writer boundary. Alembic remains the
only schema owner. Firebase SQL Connect is configured in `COMPATIBLE` mode and has no connector,
so it cannot bypass FastAPI authorization or financial posting workflows.

## Prerequisites

- The existing `edu-pay-ledger` Firebase project on the no-cost Spark plan, without a billing
  account. Starting its one-per-project SQL Connect trial requires explicit user approval because
  the 90-day lifetime begins immediately.
- The trial PostgreSQL 15 database and SQL Connect service in the same `europe-west1` location.
- Separate least-privilege migration and runtime identities. The runtime identity must not own the
  schema and must have only the table/sequence privileges required by FastAPI.
- PostgreSQL 15 client tools (`psql`, `pg_dump`, and `pg_restore`) from the same or newer minor
  release than the source.
- A fresh Supabase backup and protected Auth export before rehearsal or cutover.

Do not put database URLs in shell history or commit them. Set `SOURCE_DATABASE_URL` and
`TARGET_DATABASE_URL` in the process environment from a secret manager. Generated `.pgdump` and
`migration-evidence/` files are ignored but still contain sensitive operational evidence and must
be encrypted, access-controlled, and destroyed according to the retention decision.

## Empty-target rehearsal

1. Create a disposable empty database, then run `apps/backend/cloudsql/bootstrap.sql` as its
   database administrator. It creates only `NOLOGIN` compatibility roles and a locked empty
   `auth` surface needed to replay historical Supabase-era revisions.
2. Point `MIGRATION_DATABASE_URL` at the target and run `pnpm db:migrate`. All revisions must reach
   the single repository head. Never stamp an unexecuted revision.
3. Upgrade the source to the same reviewed revision during a controlled migration window.
4. Run a read-only protected dump first:

   ```text
   pnpm --filter @harambeeone/backend db:transfer -- --dump <protected-path>.pgdump
   ```

5. Confirm that the target contains no application rows. Then explicitly restore and verify:

   ```text
   pnpm --filter @harambeeone/backend db:transfer -- --dump <protected-path>.pgdump --overwrite --restore
   ```

The transfer is data-only, excludes `alembic_version`, preserves sequence state, uses one target
transaction, stops on the first restore error, and never puts a password in the child process
arguments. It refuses mismatched revisions and a non-empty target. After restore it writes source
and target evidence and fails unless table sets, row counts, canonical SHA-256 row hashes, every
numeric-column total, and dynamic foreign-key checks agree.

## SQL Connect boundary

The current `connectorDirs: []` setting is intentional. Direct client queries or mutations would
duplicate tenant authorization and could bypass receipt sequencing, idempotency, audit, immutable
ledger, and human-approval controls. A connector may be added only for a separately reviewed,
non-financial, least-data operation with Firebase authorization tests. `firebase
dataconnect:sql:diff` must report no unexpected destructive statement before deployment.

## Cutover and rollback

Rehearsal does not authorize production cutover. For cutover, enable maintenance mode before the
final source snapshot, rerun parity evidence, switch both auth and database configuration, execute
the multi-role golden path, and reopen writes only after acceptance. Before target writes reopen,
rollback is a configuration reversal. After target writes begin, freeze both systems and reconcile
the target delta; never allow independent writers.

The Spark SQL Connect trial is temporary: after 90 days it is archived, and it is deleted 90 days
later if the project is not upgraded. This project will not upgrade. Supabase Free therefore stays
recoverable as the durable fallback, and a return migration must be rehearsed before archival.

## Current external blockers

On 2026-10-25 the user explicitly approved starting the free trial. Firebase created SQL Connect
service `harambeeone`, Cloud SQL instance `harambeeone-fdc`, and database `harambeeone` in
`europe-west1` under project `edu-pay-ledger`. The CLI confirmed `billingEnabled: false`, identified
the instance as the SQL Connect no-cost trial, linked the permanent instance, and reported the
empty compatible schema has no required SQL changes. The 90-day trial reaches its scheduled end
around 2027-01-23; no paid upgrade is authorized.

This workstation still has no PostgreSQL client tools. F3 remains incomplete until the complete
Alembic chain, protected source snapshot, parity evidence, financial equations, authorization
tests, and rollback rehearsal pass against the new target. Supabase Free remains the active system
of record until that gate passes.
