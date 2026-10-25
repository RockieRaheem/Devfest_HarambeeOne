# Firebase foundation setup

This document covers Slice F1 only. Supabase remains the runtime provider until the later cutover slices. Firebase configuration is committed now so Auth and SQL Connect can be developed and verified without changing production behaviour.

## Safe project separation

The committed aliases use Firebase `demo-*` project IDs. Demo projects are emulator-only safeguards and cannot deploy to live Firebase resources. Authenticate locally when real development-project access is required:

```powershell
pnpm.cmd exec firebase login
```

Pass the real project explicitly with `--project <project-id>` from a protected local or CI environment variable. Do not run `firebase use --add`, because it would rewrite the tracked aliases. Keep development and production in separate Firebase projects, billing boundaries, deployment environments, and approval workflows. Never replace the committed demo IDs with environment-specific values.

## Environment configuration

Copy `.env.example` to `.env` and fill in the seven `NEXT_PUBLIC_FIREBASE_*` values from Firebase Console > Project settings > Your apps. The web API key and VAPID public key are public identifiers, not authorization controls. They still must be environment-specific.

Set `FIREBASE_PROJECT_ID` on the server. Firebase Admin must use Application Default Credentials (ADC):

- On Google Cloud, attach a dedicated least-privilege service account to the workload. Do not create a downloadable key.
- For approved local access to a real development project, set `GOOGLE_APPLICATION_CREDENTIALS` to an absolute JSON path outside this repository.
- For emulators, no credential file is needed.
- Never put a private key, client email, credential JSON, or Admin SDK value in a `NEXT_PUBLIC_*` variable.

Validate local emulator values:

```powershell
pnpm.cmd firebase:env:check:emulator
```

Validate a real environment using ADC:

```powershell
pnpm.cmd firebase:env:check
```

## Local emulators on Windows

Restore the pinned dependencies, then start the configured emulators from the repository root:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd firebase:emulators
```

Authentication listens on `127.0.0.1:9099`, SQL Connect on `127.0.0.1:9399`, and Emulator UI on `127.0.0.1:4000`. Persistent local SQL Connect data is under ignored `.firebase/`. For a one-command smoke test:

```powershell
pnpm.cmd firebase:emulators:verify
```

The committed SQL Connect service uses `COMPATIBLE` validation because Alembic remains the sole migration owner. The schema is intentionally empty in F1; do not run SQL Connect schema migration commands against any live database before Slice F3's parity review.

## Console prerequisites before F2-F6

Create and review these independently in both Firebase projects:

1. Register separate web apps and restrict each web API key to the necessary Firebase APIs and expected web origins where supported.
2. In Authentication, enable email/password and Google only. Add exact development and production authorized domains and OAuth redirect domains; remove unused localhost entries from production.
3. Configure the Google consent screen, support email, and verified application domains. Do not request scopes beyond identity.
4. Enable the FCM Registration API. Generate a Web Push certificate and place only its public VAPID key in the web environment. Keep notification permission opt-in.
5. Provision SQL Connect and Cloud SQL for PostgreSQL together. `europe-west1` is the provisional, currently supported default in the committed configuration; measure latency from Uganda and confirm residency and recovery requirements before production creation because resource locations cannot be changed in place.
6. Set billing budgets and alerts for Cloud SQL, SQL Connect, Auth, FCM, application hosting, and Gemini usage. Budgets alert; they do not automatically cap spend.
7. Use separate workload service accounts. Grant only the roles each runtime or CI job needs; avoid Owner, Editor, broad Firebase Admin, and long-lived user credentials. Review `roles/cloudsql.client` and SQL Connect permissions separately.
8. Record break-glass owners, keyless workload identity, audit-log retention, backup/PITR settings, maintenance windows, and recovery contacts before production cutover.

Real project provisioning, IAM changes, OAuth secrets, VAPID keys, and Cloud SQL creation are console/CI operator actions. They are deliberately not stored in this repository.
