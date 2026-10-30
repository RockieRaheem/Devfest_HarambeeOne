# Firebase and Gemini Migration Plan

This is the canonical plan for replacing Supabase with Firebase services and replacing Gemma with Gemini in HarambeeOne. Read this file together with `docs/MVP_ROADMAP.md` before every code, database, configuration, documentation, or interface change until every migration slice is complete.

The migration is an explicit user-authorized priority override after completion of the bursar roadmap. Work on only the first incomplete slice. Complete its implementation, tests, verification, evidence, and one-line commit before starting the next slice.

## Outcome

HarambeeOne will use:

- **Firebase Authentication** for email/password and Google sign-in.
- **Firebase SQL Connect**, backed by Cloud SQL for PostgreSQL, as the production relational database service.
- **Firebase Cloud Messaging** for consented web push notifications, while durable in-app notifications remain authoritative.
- **Gemini through the Gemini API** for the existing consented, privacy-minimized assistants and school review workflow.
- **Google AI Studio** for prompt prototyping and evaluation evidence, not as a decorative runtime dependency.
- **Cloud Run and Secret Manager** for the FastAPI service where deployment is needed for the hackathon release.

The active Next.js and FastAPI applications remain. The legacy NestJS/Prisma app stays a migration reference and must not become a second runtime.

## Architectural decisions

### Relational database, not Firestore

Use Firebase SQL Connect with Cloud SQL for PostgreSQL. Do not move the financial ledger to Cloud Firestore.

HarambeeOne depends on exact-decimal money, foreign keys, unique constraints, row locks, multi-record transactions, immutable triggers, reconciliation queries, close snapshots, and reproducible aggregate equations. PostgreSQL already implements and verifies these guarantees. A Firestore rewrite would add hackathon risk without improving the user problem.

Alembic remains the SQL schema and migration source of truth. SQL Connect must attach to the existing schema as a brownfield database, use `COMPATIBLE` validation, and decline Firebase-managed SQL migrations. The SQL Connect GraphQL schema and reviewed connectors must match the Alembic-managed database. No deploy command may apply an unreviewed destructive schema change.

### Server-owned financial access

FastAPI remains the only writer for financial, consent, settlement, receipt, audit, and support state. Browser code must not receive database credentials or a general-purpose SQL Connect mutation surface.

SQL Connect connectors may be added only for narrowly scoped, tested operations. The initial migration does not require direct client financial writes. Public campaign reads and low-risk authenticated reads may become connectors only after field-level privacy and tenant-isolation tests pass.

### Stable internal identities

Firebase UIDs must not replace internal user identifiers throughout the ledger. Introduce an identity-provider mapping from a Firebase UID to the existing stable internal user UUID. Memberships, guardian links, donor ownership, audit actors, receipts, and historical evidence continue to reference the internal UUID.

Authorization remains derived from server-owned memberships and relationships. Firebase custom claims may improve routing but must never be the sole authority for tenant or financial permissions.

### Server-side Gemini only

Gemini requests remain server-side. Browser code must never receive a Gemini API key or send unfiltered learner information directly to a model.

The initial target is the stable `gemini-3.8-flash` model through the current Google GenAI SDK and Interactions API. It provides a Gemini-family upgrade with structured output and suitable interactive latency. Evaluate it against the stable flagship `gemini-4-argon` in Google AI Studio using the same safety set. Change the runtime default only when measured privacy, output validity, latency, and cost evidence justifies it.

Model names remain configuration values, but production defaults must be explicit and tested. AI may explain, summarize, redact, or flag. It may not decide eligibility, publish a campaign, verify settlement, issue a receipt, or mutate finance.

### Durable notifications first

Firebase Cloud Messaging delivers convenience notifications. The database notification and outbox records remain the authoritative delivery intent and history. Financial transactions must succeed even when FCM is unavailable.

Push payloads must contain no learner name, guardian name, private narrative, balance, payment reference, receipt number, or other sensitive content. A notification contains a generic event label and an authenticated deep link; the application retrieves authorized details after sign-in.

## Non-negotiable invariants

Every slice must preserve these conditions:

1. `opening balance + net assessed - net collected = closing balance` at learner, class, and school level.
2. Posted financial history is corrected by linked entries, never destructive edits.
3. A failed workflow creates no partial financial state.
4. Duplicate and retried requests remain idempotent.
5. Cross-school, cross-guardian, cross-donor, and unauthenticated access fails.
6. Every consequential action retains an authenticated internal actor and audit evidence.
7. Public responses contain no learner or guardian identity except a guardian-authorized limited
   beneficiary profile after learner assent and school safeguarding approval. That profile may
   contain only the consented photograph, limited display name, and school-registration
   verification badge; admission numbers, raw documents, contacts, exact class, guardian
   identity, private narrative, and on-chain identity remain prohibited.
8. Guardian consent, learner assent, withdrawal, and human publication approval remain enforceable.
9. Gemini failure never blocks a manual workflow and never grants authority.
10. Pending contributions never count as received; only verified school settlement updates the learner ledger.
11. No source database, Firebase project, credential, or user account is deleted during migration.
12. No service-account JSON, private key, database password, Gemini key, or FCM server credential enters Git.
13. This student hackathon build remains strictly zero-cost: do not attach a billing account,
    enable a paid plan, or provision a resource that can accrue charges. Use Firebase Spark, base
    Firebase Authentication, FCM, Gemini's free developer tier, and Supabase Free only. Quota
    exhaustion must fail safely or pause the feature; it must never trigger a paid upgrade.
14. Phone authentication, Identity Platform upgrades, Cloud Run, paid Gemini models, and paid
    Cloud SQL remain prohibited unless the user explicitly changes the zero-cost constraint.

## Working and commit discipline

For every slice:

1. Re-read this plan and `docs/MVP_ROADMAP.md`.
2. Confirm the slice is the first incomplete migration priority.
3. Inspect the worktree and preserve unrelated user changes.
4. Re-check current official Firebase and Gemini documentation for the services touched.
5. Define the data, API, authorization, audit, loading, empty, error, retry, and rollback behaviour before editing.
6. Implement one complete vertical migration slice.
7. Run its focused tests plus the required regression gates.
8. Update status and verification evidence only after the gates pass.
9. Commit the coherent slice with one concise, single-line message.
10. Do not begin the next slice while required behaviour or verification is incomplete.

Commit messages must contain one subject line only, with no body. Planned subjects are listed per slice and may be refined while remaining concise.

## Starting baseline

- Active web: Next.js 15 and React 19.
- Active API: FastAPI, Pydantic, SQLAlchemy, and Alembic.
- Current identity: Supabase Auth with email/password and Google OAuth.
- Current database: Supabase PostgreSQL with RLS, grants, constraints, triggers, and 34 operational tables.
- Current AI: Gemini integration behind consent, minimization, structured validation, human review, rate limits, and safe failure.
- Current notifications: durable in-app notifications and a provider-neutral delivery outbox.
- Baseline verification on 2026-10-25: all 111 backend tests passed. Frontend lint/build could not start because the local pnpm dependency links were incomplete; dependency restoration is a gate in Slice F1.
- Initial repository baseline commit: `8c65fab`.

## Ordered migration slices

### Slice F0 - Canonical migration plan

Status: **COMPLETE**

Deliver:

- Record the Firebase SQL Connect, Firebase Auth, FCM, Gemini, and deployment decisions.
- Make this document a mandatory pre-change reference.
- Establish ordered completion gates and one-line commit discipline.
- Preserve the original project as a committed baseline before migration work.

Completion gate:

- The baseline is committed with the configured repository identity.
- The plan identifies the first implementation slice, rollback boundaries, verification gates, and prohibited shortcuts.
- `docs/MVP_ROADMAP.md`, `AGENTS.md`, and the repository documentation index point to this plan.

Planned commit: `Plan Firebase and Gemini migration`

### Slice F1 - Firebase project and local foundation

Status: **COMPLETE**

Deliver:

- Restore the pinned pnpm dependency graph and prove the unchanged web lint and production build before migration edits.
- Create separate Firebase development and production project configuration without committing credentials or project-specific secrets.
- Add reviewed `firebase.json`, project aliases, SQL Connect compatible-mode configuration, emulator configuration, and documented Windows commands.
- Add Firebase client and Admin SDK dependencies at pinned versions.
- Add environment validation for public Firebase web configuration and server-only application-default credentials.
- Configure Auth and SQL Connect emulators for repeatable local and CI verification.
- Document console-only prerequisites: authorized domains, email/password, Google provider, OAuth redirect domains, FCM registration API, VAPID public key, Cloud SQL region, budgets, and least-privilege IAM.

Completion gate:

- No runtime path has changed.
- Firebase emulators start from committed configuration.
- Secrets and service-account files are rejected by `.gitignore` and secret scanning.
- Existing 111 backend tests, backend lint, web lint, TypeScript checking, and production build pass after dependency restoration.

Planned commit: `Add Firebase migration foundation`

### Slice F2 - Firebase Authentication and identity bridge

Status: **COMPLETE**

Deliver:

- Introduce a provider-neutral server identity interface before removing Supabase code.
- Add Firebase email/password, Google sign-in, email verification, password recovery, sign-out, disabled-user, and revoked-session behaviour.
- Exchange a recently issued Firebase ID token for a Secure, HttpOnly, SameSite session cookie; verify revocation for sensitive operations.
- Verify Firebase sessions in Next.js and FastAPI using the Admin SDK.
- Create a Firebase UID-to-internal-user mapping without rewriting historical UUID ownership.
- Preserve role-aware workspace routing, multi-unit memberships, guardian invitations, donor ownership, and audited actors.
- Build an idempotent user migration command. Test whether existing password hashes can be imported safely; otherwise require a controlled password reset. Map Google identities without creating duplicate internal people.
- Support a temporary test-only compatibility boundary until Firebase login and every protected route pass; do not run two production authorities indefinitely.

Completion gate:

- Email/password and Google users can sign in, refresh, sign out, recover access, and reach the correct workspace.
- Wrong-email, expired invitation, replay, revoked session, disabled user, missing membership, and cross-tenant attempts fail.
- Historical actor and ownership references remain stable.
- No authorization decision relies only on browser state or editable claims.
- Supabase Auth is not disabled until the cutover slice.

Planned commit: `Migrate authentication to Firebase`

### Slice F3 - Cloud SQL and Firebase SQL Connect migration

Status: **COMPLETE**

Deliver:

- Use the existing `edu-pay-ledger` Spark project's single 90-day SQL Connect trial only after
  explicit approval to start its one-time clock; never attach billing. Keep Supabase Free as the
  durable system of record and rollback because the trial is archived after 90 days.
- Retain Alembic migration ownership and configure SQL Connect for the brownfield schema in `COMPATIBLE` mode.
- Adapt Supabase-specific migrations and runtime assumptions: `auth.users`, `auth.uid()`, Supabase API grants, Supabase JWT helpers, and Data API policies.
- Preserve PostgreSQL constraints, numeric money types, triggers, indexes, immutable history, uniqueness, row locks, snapshot hashes, and audit evidence.
- Keep defense in depth using server-only database access plus tenant-aware PostgreSQL policies or transaction-local authorization context where verified safe with connection pooling.
- Define reviewed SQL Connect schema and minimal connectors that cannot bypass FastAPI financial workflows.
- Create repeatable source export and target import tools with schema version, row counts, foreign-key checks, per-table hashes, and financial control totals.
- Rehearse migration using synthetic or disposable data before any shared environment.

Completion gate:

- All Alembic revisions apply to an empty Cloud SQL target.
- A Supabase PostgreSQL snapshot imports without lost or duplicated rows.
- Every financial equation and immutable close hash agrees before and after migration.
- Tenant, role, guardian, donor, public-data, duplicate, retry, rollback, and database-constraint tests pass on Cloud SQL.
- SQL Connect schema diff reports no unexpected destructive change and connector security review passes.

Completion evidence:

- Added a locked Cloud SQL bootstrap for the historical Alembic chain and a rehearsal-only,
  data-only transfer tool that refuses revision drift, non-empty targets, exposed database
  passwords, and partial restores. Deterministic evidence compares table sets, row counts,
  canonical SHA-256 hashes, every numeric-column total, and foreign-key integrity.
- Passed the repository-side migration tooling checks before starting the live rehearsal; later
  evidence below supersedes the earlier source-revision and test-count snapshot.
- On 2026-10-25, explicit approval started the `edu-pay-ledger` project's one-time Spark trial.
  Firebase created service `harambeeone`, instance `harambeeone-fdc`, and database `harambeeone`
  in `europe-west1`; billing remained disabled and `dataconnect:sql:diff` reported the empty target
  compatible with the committed schema. The trial is expected to end around 2027-01-23.
- Replayed the complete Alembic chain on the Firebase-managed PostgreSQL 18.6 target and reached
  `f15a2c9e7b41`. Upgraded the Supabase source to the same additive revision, transactionally
  copied all 166 rows across 77 application tables, and proved matching ordered row hashes and
  numeric totals. The post-migration SQL Connect diff remained compatible.
- Revoked and verified removal of the operator's temporary schema-owner membership after the
  rehearsal; writer access remains only for controlled verification.
- Added a passwordless FastAPI runtime path through the official Cloud SQL Python Connector with
  automatic IAM database authentication; the source URL path remains the rollback default.
  Authenticated sessions now install the stable internal user UUID as transaction-local PostgreSQL
  context and restore it after commits. Only reviewed public and integration workflows explicitly
  assume the validated server role, preventing pooled connections from leaking request identity.
- Added and passed a passwordless live IAM control suite covering owner revocation, writer
  membership, login-role RLS behavior, required RLS metadata, retry constraints, immutable
  evidence, financial equations, audit actors, index validity, public grants, and no-context tenant
  denial. Repository regression evidence is 127 backend tests plus Ruff.
- Created the keyless `harambeeone-api` runtime service account with only Cloud SQL Client and
  Cloud SQL Instance User at project level and zero user-managed keys. PostgreSQL verified writer
  membership, no owner membership, and no direct runtime-login `BYPASSRLS`; project billing
  remains disabled. The operator has Token Creator only on that service account for local testing;
  impersonated ADC contains no private key and the FastAPI Cloud SQL readiness path passed as the
  runtime identity. The ignored local environment records the target but retains the URL provider.
- Passed a rollback-only live FastAPI and database matrix using synthetic owner, bursar, cashier,
  auditor, guardian, and donor identities. It proved API permissions, cashier payment posting,
  tenant and portal isolation, unknown-user denial, explicit server-only access, duplicate
  rejection, and zero persisted probe rows. The live journey exposed and fixed an owner-only
  receipt-sequence policy, a cross-table trigger field reference, and missing consented guardian
  join policies; all fixes are additive Alembic revisions on both databases.
- Created and independently verified an AES-256-GCM source backup from one repeatable-read
  transaction. It contains all 78 public tables including `alembic_version` (167 total rows), one
  Supabase Auth user, and one Auth identity. The ignored authenticated artifact and manifest are
  separated from a 256-bit key stored outside the repository with a user-only Windows ACL; no
  database credential, plaintext identity, or encryption key entered Git.
- Upgraded both databases through additive head `f7a2d41e6c93`; each Cloud SQL migration used a
  Firebase-managed owner window and verified its immediate revocation. The final live IAM suite
  passed revision, role, RLS, constraint, immutability, financial-equation, audit, index, public-
  grant, runtime-role, and no-context-denial controls. SQL Connect reported the schema compatible.
- Refreshed and independently verified the encrypted source/Auth snapshot at the final head, then
  passed the read-only rollback rehearsal through the real FastAPI engine factory: source URL
  (4.01s), Cloud SQL (7.27s), then source URL (3.52s), with `.env` unchanged and no writes opened.
- Passed all 127 backend tests using a repository-local pytest temp directory, Ruff, ESLint,
  TypeScript, backend compilation, and the optimized 50-route Next.js build. Supabase Free remains
  authoritative and the durable fallback until the later cutover slice deliberately opens Cloud
  SQL application writes.

Commit: `Complete Cloud SQL migration rehearsal`

### Slice F4 - Gemini model and API upgrade

Status: **COMPLETE**

Deliver:

- Replace Gemma-specific configuration, code, naming, documentation, and consent text with Gemini-specific equivalents.
- Select only a model currently available in the Gemini Developer API free tier, with hard request,
  token, and timeout bounds plus manual fallback when the free quota returns `429`.
- Use the maintained Google GenAI SDK and Interactions API with `gemini-3.8-flash` as the initial runtime model.
- Preserve Pydantic structured outputs, minimum grounding, redaction, timeouts, rate limits, stateless handling, metadata-only audit, and human approval.
- Create a versioned Google AI Studio evaluation set covering safe summaries, identifier leakage, prompt injection, cross-user extraction, financial-authority claims, malformed output, uncertainty, latency, and failure fallback.
- Compare `gemini-3.8-flash` with `gemini-4-argon`; record the chosen model and why. Do not select a model only because it is larger.
- Make model failure visible but non-blocking to every manual workflow.

Completion gate:

- No Gemma runtime reference remains.
- All assistant and school-review tasks return valid structured responses on the selected Gemini model.
- Hostile prompts cannot expose private data, grant authority, or mutate state.
- Consent, privacy notice, retention statement, and cross-border-processing language match the actual Gemini flow.
- Automated tests cover model success, refusal, malformed output, timeout, unavailable service, and safe fallback.

Completion evidence:

- The pinned Google GenAI SDK now uses the Interactions API with `store=false`, exact Pydantic response schemas, bounded input/output, a 20-second timeout, SDK retries disabled, metadata-only audit, and explicit non-blocking fallbacks for quota and provider failure.
- The versioned AI Studio evaluation set and model decision record select free-tier `gemini-3.8-flash`; `gemini-4-argon` was excluded because it is not available on the free tier. Guardian, donor, and school-review assistants share the same privacy, grounding, authority, and identifier-leakage controls.
- Reversible migration `a8c4e2f19b70` renamed consent data on both Supabase and Cloud SQL. Cloud SQL passed revision, least-privilege, RLS, immutable-history, financial-equation, audit, index, runtime-role, and public-grant checks; Firebase confirmed SQL Connect compatibility and the temporary owner grant was revoked.
- All 131 backend tests, Ruff, TypeScript, ESLint, Python compilation, and the optimized 50-route Next.js build passed. A live synthetic call reached Gemini and failed safely during provider `503` and timeout responses; automated tests prove valid output, refusal, malformed output, timeout, unavailable service, quota fallback, and disabled retries.
- 2026-10-30 production reliability update: repeated synthetic `gemini-3.8-flash` checks exceeded both the original 20-second and an expanded 45-second bound, and the standard endpoint returned `504 DEADLINE_EXCEEDED`. The same exact Pydantic review schema completed successfully on free-tier `gemini-3.1-flash-lite` in 13.8 seconds. Runtime calls now use the maintained SDK's standard structured `generate_content` endpoint, retain `store=false`, one bounded request, exact post-response validation, and explicit quota, timeout, provider, and malformed-output fallbacks.

Commit: `Upgrade assistants to Gemini`

### Slice F5 - Firebase Cloud Messaging

Status: **COMPLETE**

Deliver:

- Add an explicit notification opt-in flow; never request browser permission on first page load.
- Add the HTTPS service worker, foreground and background handlers, VAPID public configuration, and supported-browser fallback.
- Store installation identifiers or registration tokens against the internal user with device label, consent time, last-seen time, and revocation state.
- Connect the existing notification outbox to an FCM delivery worker using Firebase Admin credentials.
- Keep FCM on the no-cost Firebase product and do not introduce Cloud Functions or another paid
  worker dependency; the existing FastAPI process owns bounded delivery.
- Send generic, privacy-safe payloads with authenticated deep links for invitation, consent, changes requested, publication, pledge, settlement, rejection, funded, receipt, and outcome events.
- Make delivery idempotent, retryable, observable, and independent of financial commits.
- Remove invalid or unregistered devices safely and allow users to disable a device or all push delivery.
- Retain in-app notifications as the source of truth when permission is denied, the browser is unsupported, or FCM is unavailable.

Completion gate:

- A consented browser receives foreground and background notifications for the required event set.
- Denied permission and unsupported browsers retain complete in-app behaviour.
- Push retry cannot duplicate a financial operation or user notification record.
- Payload inspection proves no learner identity, private narrative, financial amount, payment reference, or receipt identifier leaves through FCM.
- Cross-user device targeting and revoked-token delivery fail.

Completion evidence:

- Added explicit signed-in opt-in controls, a root-scoped service worker, foreground and background
  handlers, public VAPID configuration, supported-browser fallback, per-user FID ownership,
  per-device and all-device revocation, and durable in-app fallback.
- The existing FastAPI process now drains the notification outbox in bounded batches. Delivery is
  deduplicated per outbox and installation, retries with bounded backoff, revokes invalid targets,
  remains independent of financial commits, and sends only event category, authenticated relative
  link, and notification identifier through FCM.
- Automated coverage proves opt-in ownership, cross-user rejection, opt-out, invalid-device
  revocation, retry, deduplication, safe payload minimization, and authoritative in-app behavior.
  The live database verifier passed ownership, RLS, grants, uniqueness, and retry indexes.
- A real consented Chrome installation received a user-confirmed foreground update and a
  user-confirmed background operating-system notification. Firebase accepted both live deliveries
  without retry or invalid-target errors.
- All 145 backend tests, Ruff, ESLint, TypeScript, and the optimized 50-route Next.js build passed.

Commit: `Deliver Firebase push notifications`

### Slice F6 - Deployment, cutover, and release proof

Status: **IN PROGRESS**

Deliver:

- Produce a zero-cost demo deployment or documented local demo path. Cloud Run and any hosting
  path that requires a billing account are prohibited under the zero-cost boundary.
- Configure Firebase Auth domains, cookies, CORS, and FCM service-worker scope only on a verified
  no-cost hosting path; never attach billing merely to deploy server-side rendering.
- Back up Supabase PostgreSQL and export Supabase Auth mappings before cutover.
- Enter maintenance mode for the final database delta; do not dual-write the financial ledger.
- Import, verify, switch database and authentication configuration, then run the full multi-role browser/API journey.
- Keep Supabase read-only and recoverable through the acceptance window. Deletion or billing shutdown requires a separate explicit user decision.
- Record a timed rollback procedure that restores the previous configuration without losing writes.
- Update README, architecture, security, integration, setup, and handoff documentation to describe only the final verified system.

Completion gate:

- The full sign-up-to-period-close and referral-to-outcome journeys pass on Firebase/Google infrastructure.
- All backend tests, lint, TypeScript checks, web production build, emulator tests, Cloud SQL verification, Firebase Auth negative tests, Gemini adversarial tests, and FCM delivery tests pass.
- The live demo works from a clean browser without local services.
- Monitoring shows no unhandled auth, database, Gemini, or FCM errors during the release smoke test.
- Supabase packages, environment requirements, runtime calls, and production dependencies are removed only after parity is proven.
- A usable free fallback exists before the SQL Connect trial is archived; no release depends on a
  resource that silently becomes billable.

Planned commit: `Complete Firebase production cutover`

## Cutover and rollback boundaries

The migration uses a rehearsal-first, single-writer cutover:

1. Apply schema to a disposable Cloud SQL database.
2. Import a scrubbed or synthetic snapshot and verify it.
3. Import a fresh source snapshot into the production target and verify counts, hashes, and equations.
4. Migrate or map identities and test access without enabling writes.
5. Enable maintenance mode on the source application.
6. Export and import the final delta.
7. Re-run all integrity checks.
8. Switch configuration to Firebase Auth and Cloud SQL.
9. Execute smoke and multi-role journeys.
10. Reopen writes only after acceptance gates pass.

Rollback before writes reopen is a configuration reversal. If target writes have begun, do not switch back casually: freeze both sides, export the target delta, reconcile it, and follow a documented recovery decision. Never allow Supabase and Cloud SQL to accept independent financial writes.

## Required verification matrix

Every affected slice must select and run the relevant checks from this matrix:

- Authentication: email/password, Google, verification, recovery, refresh, logout, revocation, disabled user, expired session.
- Authorization: unauthenticated, missing role, wrong role, cross-school, cross-unit, cross-guardian, cross-donor, public/private boundary.
- Finance: exact decimals, duplicate reference, idempotent retry, concurrent submission, rollback, reversal, receipt sequence, report agreement, close hash.
- Migration: schema parity, row counts, nullability, foreign keys, unique indexes, triggers, policies, identity mapping, hashes, aggregate equations.
- Gemini: consent, minimization, valid schema, PII leakage, injection, authority claim, timeout, malformed output, rate limit, manual fallback.
- FCM: opt-in, opt-out, foreground, background, invalid token, wrong user, retry, deduplication, safe payload, in-app fallback.
- Release: backend suite, Ruff, frontend ESLint, TypeScript, optimized build, emulator suite, live health/readiness, clean-browser golden path.

## Progress evidence

Add a dated entry only after a slice changes status. Include the exact verification performed and the one-line commit identifier.

- 2026-10-25: Established the 527-file repository baseline in commit `8c65fab`; secret and large-file audits found no credential file or Git-hosting size problem. All 111 backend tests passed. Frontend lint/build were attempted but could not start because local pnpm dependency links were incomplete, which is now an explicit Slice F1 gate.
- 2026-10-25: Completed Slice F1 in `Add Firebase migration foundation`. Restored the frozen pnpm graph; pinned Firebase Web 13.1.0, Node Admin 14.5.0, Python Admin 7.7.0, and CLI 15.34.1; started Auth and SQL Connect emulators and passed the reachability smoke test; validated emulator environment defaults; confirmed credential filenames are ignored and a private-key/API-key pattern scan found no matches; passed all 111 backend tests, Ruff, ESLint, TypeScript, backend compilation, and the optimized 51-route Next.js build. Runtime authentication, database, and AI paths remain unchanged.
- 2026-10-25: Completed Slice F2 in `Migrate authentication to Firebase`. Firebase email/password and Google sign-in now exchange recent verified ID tokens for Secure, HttpOnly, SameSite session cookies; Next.js and FastAPI verify server-side identity and revocation; a provider-neutral UUID bridge preserves historical ownership; and an idempotent Supabase Auth export importer validates bcrypt hashes, Google identities, duplicates, and reset cases without exposing secrets. Removed the obsolete browser Supabase Auth routes while retaining the documented rollback verifier and source service through cutover. Passed all 119 backend tests (including authorization, invitations, membership, tenant, portal, identity, disabled-user, and revocation coverage), Ruff, ESLint, TypeScript, backend compilation, the optimized 50-page Next.js build, and the Firebase Auth emulator journey for verification, recovery, Google, sessions, disabled users, and revocation.
- 2026-10-27: Completed Slice F5 in `Deliver Firebase push notifications`. Explicit consent, Firebase Installation ID ownership, root-scoped service-worker handling, privacy-safe payloads, bounded FastAPI outbox delivery, deduplication, retry, invalid-target revocation, opt-out, and in-app fallback are implemented. A real Chrome installation received user-confirmed foreground and background delivery; both provider sends completed without retry or invalid-target errors. The live database verifier, all 145 backend tests, Ruff, ESLint, TypeScript, and the optimized 50-route build passed.

## Official decision references

- Firebase SQL Connect overview: <https://firebase.google.com/docs/sql-connect>
- Firebase SQL Connect pricing and Spark trial: <https://firebase.google.com/docs/sql-connect/pricing>
- Firebase pricing plans: <https://firebase.google.com/docs/projects/billing/firebase-pricing-plans>
- Gemini Developer API pricing: <https://ai.google.dev/gemini-api/docs/pricing>
- Existing-database and custom-migration workflow: <https://firebase.google.com/docs/sql-connect/manage-services-and-databases>
- SQL Connect schema and connector management: <https://firebase.google.com/docs/sql-connect/manage-schemas-and-connectors>
- Firebase Authentication session cookies: <https://firebase.google.com/docs/auth/admin/manage-cookies>
- Firebase ID-token verification: <https://firebase.google.com/docs/auth/admin/verify-id-tokens>
- Firebase Cloud Messaging for web: <https://firebase.google.com/docs/cloud-messaging/web/get-started>
- Current Gemini models: <https://ai.google.dev/gemini-api/docs/models>
- Gemini structured outputs: <https://ai.google.dev/gemini-api/docs/structured-output>
- Gemini API and Interactions migration guidance: <https://ai.google.dev/gemini-api/docs>
