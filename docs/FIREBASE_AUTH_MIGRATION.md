# Firebase Authentication migration

Slice F2 moves interactive authentication to Firebase while preserving every historical internal user UUID. Supabase PostgreSQL and Supabase Auth remain recoverable until the final cutover; they are not deleted or disabled here.

## Security model

The browser signs in with the Firebase Web SDK. It sends a freshly issued ID token and a same-origin double-submit CSRF token to `/auth/session`. The Node Admin SDK requires an authentication time within five minutes and a verified email, then creates a five-day `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` session cookie. Browser Firebase credentials are cleared after the exchange.

Next.js verifies the cookie for profile/session operations and forwards it only to the configured HarambeeOne API. FastAPI independently verifies the Firebase session with revocation checking, maps the Firebase UID to an internal UUID, and performs every role, school, unit, guardian, donor, and financial authorization from PostgreSQL. Firebase custom claims and email addresses never grant access by themselves.

Normal sign-out clears the browser and server cookie. Operators can revoke refresh tokens or disable a Firebase user; the next protected request fails because both server verifiers check revocation/disabled state. A future account-security interface may call the existing session DELETE endpoint with `revokeAll: true` to sign out every device.

## Firebase Console setup

Perform these steps separately in development and production projects:

1. Enable Email/Password and Google providers. Configure the Google support email and OAuth consent screen.
2. Add only the exact local and deployed authorized domains. Remove unused localhost domains from production.
3. Require the password policy used by the interface: at least ten characters with a letter and number. Enable email enumeration protection and appropriate abuse monitoring.
4. Configure the password-reset email action URL to the deployed `/reset-password` route so Firebase appends `mode` and `oobCode`. Configure email verification to continue to `/login` after Firebase applies the code.
5. Register the real web configuration in environment variables. Do not treat the public Firebase API key as authorization.
6. Run Next.js and FastAPI with ADC. On Google Cloud, attach a dedicated keyless service identity; do not download an Admin SDK key.
7. Set `AUTH_PROVIDER=firebase`. Never set either Auth emulator host in production.

Run the local repeatable journey with the committed demo project:

```powershell
pnpm.cmd firebase:auth:verify
```

It exercises email signup, verification, password login, session-cookie creation and verification, password recovery, a mock Google identity, disabled-user rejection, revocation rejection, and emulator cleanup.

## Existing-user migration

Obtain a protected Supabase Auth export through an approved administrative channel. The JSON must be stored outside this repository and limited to the migration operators. The tool accepts an array or `{ "users": [...] }` with Supabase fields including `id`, `email`, `encrypted_password`, `email_confirmed_at`, `raw_user_meta_data`, and `identities`.

Validate without contacting Firebase or changing PostgreSQL:

```powershell
pnpm.cmd auth:migrate -- D:\protected\supabase-auth-export.json
```

After reviewing counts, use the development Firebase project and a rehearsed database first:

```powershell
pnpm.cmd auth:migrate -- D:\protected\supabase-auth-export.json --apply
```

The migration is idempotent and refuses duplicate normalized emails, subject collisions, UID/email mismatches, and silent same-email linking. It uses the historical Supabase UUID as the imported Firebase UID and records explicit Firebase and Supabase mappings to the same internal UUID. Existing BCRYPT password hashes are supported by Firebase and imported without logging them. Accounts without a compatible BCRYPT password or Google identity are counted for controlled password reset. The tool never commits an identity mapping for a Firebase batch that reports an import error; a retry safely reconciles accounts created before an interrupted database commit.

Export files contain password hashes and identity metadata. Never put them in the workspace, source control, chat, issue trackers, build logs, or ordinary cloud drives. Delete them using the approved retention procedure only after the cutover acceptance window.

## Rollback boundary

`AUTH_PROVIDER=supabase` retains the previous JWT verifier only for development or an explicitly controlled rollback before final cutover. Configuration rejects it in production. Do not let Firebase and Supabase independently create production identities indefinitely, and never infer an existing internal identity from an email match. The final cutover slice removes Supabase runtime authentication only after migration counts, role journeys, invitations, guardian/donor ownership, and audit actors pass.
