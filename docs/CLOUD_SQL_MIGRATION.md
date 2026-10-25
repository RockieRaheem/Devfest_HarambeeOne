# Cloud SQL migration runbook

This runbook implements Slice F3's rehearsal-first, single-writer boundary. Alembic remains the
only schema owner. Firebase SQL Connect is configured in `COMPATIBLE` mode and has no connector,
so it cannot bypass FastAPI authorization or financial posting workflows.

## Prerequisites

- A real Firebase/Google Cloud project with billing enabled; `demo-*` project IDs cannot provision.
- A PostgreSQL 15 Cloud SQL instance and SQL Connect service in the same `europe-west1` location.
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

## Current external blockers

As of 2026-10-25, this workstation has no Google Cloud CLI, PostgreSQL client tools, or reachable
disposable PostgreSQL target. The configured production alias is `demo-harambeeone-production`,
not a verified billable project. Therefore no Cloud SQL resource has been provisioned and F3 must
remain incomplete until the project ID/billing authority and target credentials are supplied and
the full rehearsal evidence passes.
