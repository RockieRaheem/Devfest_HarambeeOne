# Cloud SQL migration runbook

This runbook implements Slice F3's rehearsal-first, single-writer boundary. Alembic remains the
only schema owner. Firebase SQL Connect is configured in `COMPATIBLE` mode and has no connector,
so it cannot bypass FastAPI authorization or financial posting workflows.

## Prerequisites

- The existing `edu-pay-ledger` Firebase project on the no-cost Spark plan, without a billing
  account. Starting its one-per-project SQL Connect trial requires explicit user approval because
  the 90-day lifetime begins immediately.
- The trial PostgreSQL database and SQL Connect service in the same `europe-west1` location. The
  provisioned Firebase-managed instance currently reports PostgreSQL 18.6.
- Separate least-privilege migration and runtime identities. The runtime identity must not own the
  schema and must have only the table/sequence privileges required by FastAPI.
- A fresh Supabase backup and protected Auth export before rehearsal or cutover.

Do not put database URLs in shell history or commit them. The IAM migration commands read the
source URL from the ignored `.env` file and obtain a short-lived target credential through the
Firebase CLI login; they never require a target password. `migration-evidence/` is ignored but
still contains sensitive operational evidence and must be access-controlled and destroyed
according to the retention decision.

## Empty-target rehearsal

1. Explicitly grant the reviewed operator the Firebase SQL owner role for the migration window.
2. Apply the locked compatibility bootstrap and complete Alembic chain through the IAM connector:

   ```text
   pnpm firebase:sql:schema -- --instance PROJECT:REGION:INSTANCE --database DATABASE --user OPERATOR_EMAIL --owner-role FIREBASE_OWNER_ROLE --runtime-role FIREBASE_WRITER_ROLE
   ```

   The runner refuses a non-empty target, maps historical Supabase-only roles and auth helpers to
   locked compatibility objects, enables the built-in `pgcrypto` extension, and verifies the
   single executed Alembic head. It never stamps an unexecuted revision.
3. Upgrade the source to the same reviewed revision during a controlled migration window.
4. Confirm that the target contains no application rows, then copy and verify in one target
   transaction:

   ```text
   pnpm firebase:sql:data -- --instance PROJECT:REGION:INSTANCE --database DATABASE --user OPERATOR_EMAIL --owner-role FIREBASE_OWNER_ROLE --evidence-dir migration-evidence/REHEARSAL
   ```

The transfer is data-only, excludes `alembic_version`, follows foreign-key dependency order, uses
one repeatable-read source snapshot and one target transaction, and stops on the first error. It refuses mismatched revisions, table drift,
and a non-empty target. It disables only user triggers during the snapshot load, restores them
before commit, and leaves foreign-key constraint triggers active. After commit it writes source and
target evidence and fails unless table sets, row counts, canonical SHA-256 row hashes, and every
numeric-column total agree. The existing PostgreSQL-client transfer tool remains available as a
second rehearsal path where matching `pg_dump` and `pg_restore` binaries are installed.

## SQL Connect boundary

The current `connectorDirs: []` setting is intentional. Direct client queries or mutations would
duplicate tenant authorization and could bypass receipt sequencing, idempotency, audit, immutable
ledger, and human-approval controls. A connector may be added only for a separately reviewed,
non-financial, least-data operation with Firebase authorization tests. `firebase
dataconnect:sql:diff` must report no unexpected destructive statement before deployment.

FastAPI's Cloud SQL sessions use transaction-local database context so pooled connections do not
retain one request's identity. Authenticated requests resolve the verified Firebase identity to the
stable internal UUID and set `request.jwt.claim.sub`; the SQLAlchemy transaction hook restores it
after any commit starts a new transaction. Public campaign routes and integration clients cannot
derive an end-user UUID, so only those reviewed server workflows explicitly assume the validated
Firebase writer role. Neither the role name nor any database credential is accepted from a browser.

After each schema or access change, run the passwordless live control check as the IAM operator:

```text
pnpm firebase:sql:verify -- --instance PROJECT:REGION:INSTANCE --database DATABASE --user OPERATOR_EMAIL --owner-role FIREBASE_OWNER_ROLE --writer-role FIREBASE_WRITER_ROLE
```

It checks the Alembic revision, owner revocation, controlled writer membership, login-role RLS
behavior, required RLS tables, retry constraints, immutable triggers, sealed financial equations,
audit actors, index validity, public grants, no-context tenant denial, and a rolled-back immutable
ledger mutation attempt.

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

The empty-target Alembic rehearsal reached `f15a2c9e7b41`. The Supabase source was upgraded to the
same additive revision, and the IAM transfer proved exact parity for 77 application tables and 166
rows using ordered row hashes and numeric totals. A post-migration SQL Connect diff reported the
database compatible. FastAPI now has a passwordless Cloud SQL Python Connector path using
automatic IAM database authentication, while the URL path remains the rollback default.

F3 remains incomplete until a least-privilege runtime identity and local ADC are configured, the
full multi-role API and PostgreSQL verification suites pass against Cloud SQL, a protected source
backup and Auth export exist, and rollback is rehearsed. Supabase Free therefore remains the active
system of record; no Cloud SQL application writes are open.

After the rehearsal, the operator's temporary schema-owner membership was explicitly revoked and
verified absent; writer membership remains only for the outstanding controlled verification work.
The live IAM control suite passed with the unprivileged login unable to read tenant or ledger rows
without request context, and with immutable ledger enforcement still active under the writer role.
