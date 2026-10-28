# Donation demo deployment runbook

HarambeeOne's donation experience is production-build and container ready, while the Stellar rail remains explicitly testnet-only. Testnet XLM has no monetary value and must never be described as a real fiat settlement.

## Zero-cost boundary

Do not enable Firebase Cloud Storage for campaign images: current Firebase projects require the Blaze billing plan. Approved images are therefore resized, metadata-stripped, re-encoded and stored under a strict size limit in the existing PostgreSQL database.

Firebase Hosting on Spark can host static assets, but it cannot run the current FastAPI service or the server-rendered Next.js gateway. Firebase App Hosting and Cloud Run require a billing account. The public demo therefore uses two Render Free web services from the committed `render.yaml`; do not add a payment method or upgrade either service.

Render provides 750 shared Free instance hours per workspace each month and spins an idle web service down after 15 minutes. The first request after sleep can take about one minute. This is appropriate for the judged demo, not a production service-level agreement. With no payment method, exhausted free usage suspends services or builds instead of creating a charge.

## Required runtime configuration

Set secrets only in the hosting provider's encrypted environment configuration. Never bake them into either image.

- Web: `API_URL`, Firebase public web configuration, `NODE_ENV=production`.
- API: database provider settings, Firebase Admin application-default credentials, Gemini key when enabled, `NODE_ENV=production`, and `CORS_ALLOWED_ORIGINS=https://YOUR_WEB_HOST`.
- Stellar: `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org`, `STELLAR_DEMO_UGX_PER_XLM=1000`, and `STELLAR_DEMO_FAUCET_ENABLED=false` for every public deployment.

Production validation rejects wildcard or non-HTTPS CORS origins, a Firebase Auth emulator, a non-Firebase auth provider, a non-official Horizon URL, and an enabled Friendbot demo faucet.

## Render Free release

1. In Render, create a Blueprint from this repository's `main` branch and review that both `harambeeone` and `harambeeone-api` use the `Free` plan before applying it.
2. Enter every `sync: false` value from the protected local `.env`; never paste `.env` wholesale because it contains obsolete development and rollback values.
3. Create two least-privilege Google service accounts. The web identity needs Firebase Authentication administration for session creation and revocation. The API identity needs Firebase Authentication read access, Firebase Cloud Messaging delivery, Cloud SQL Client and Cloud SQL Instance User. Do not grant Owner or Editor.
4. Create one short-lived deployment key for each identity only because Render's keyless Google OIDC integration is unavailable on its Free workspace plan. In each corresponding Render service, add a secret file named `google-application-credentials.json`; Render mounts it at `/etc/secrets/google-application-credentials.json`. Never paste either JSON key into an environment variable, terminal output, issue, chat or Git.
5. Delete the downloaded local key copies immediately after both Render secret files are saved. Record their key IDs, restrict access to the Render account with MFA, and rotate/delete the keys after the demonstration. A future paid or Google-hosted release must replace these keys with workload identity federation.
6. Confirm the API health check is `/health/readiness`, the web health check is `/api/health`, and both services are in Frankfurt. The committed containers add their non-root users only to Render's secret-file group.
7. Add `harambeeone.onrender.com` to Firebase Authentication authorized domains. If Render assigns a suffixed hostname, update `CORS_ALLOWED_ORIGINS`, `API_URL`, and the Firebase authorized domain to the exact assigned HTTPS hostname before smoke testing.

The Firebase browser configuration and VAPID value are public identifiers, but Render still receives them through protected configuration to prevent development/production mix-ups. The Gemini API key and both Google credential files are secrets.

## Build and release

```powershell
docker build -f apps/backend/Dockerfile -t harambeeone-api apps/backend
docker build -f apps/web/Dockerfile -t harambeeone-web .
```

Before starting application traffic:

1. Back up the current database.
2. Run `python -m alembic upgrade head` as a one-off migration job using the same reviewed release.
3. Start the API and require `/health/readiness` to return `200`.
4. Start the web container with `API_URL` pointing to the HTTPS API origin.
5. Add the exact web origin to Firebase Authentication authorized domains and `CORS_ALLOWED_ORIGINS`.
6. Verify sign-in, one public campaign image, one ordinary payment intent and one Stellar testnet payment from a clean browser.

The containers run as non-root users, keep development dependencies outside the runtime image, expose explicit ports, and use Next.js standalone output. The API image includes a readiness health check.

## Donation release smoke test

1. Record separate guardian media consent and a valid learner assent state.
2. Upload an owner-reviewed JPEG, PNG or WebP under 1.5 MB. Confirm the public response is WebP, has an ETag, and contains no original metadata.
3. Register and verify an institution-controlled Stellar `G...` public account. Never enter or store its secret key.
4. From a signed-out browser, open a campaign, choose Stellar Testnet, and prepare a donation.
5. Send the exact XLM amount with the exact public campaign memo.
6. Confirm Horizon verification creates one payment, one allocation, one learner-ledger credit, one receipt and one confirmed blockchain proof.
7. Retry confirmation and verify no duplicate financial record is created.
8. Open the explorer link from tracking, then remove the campaign image and verify public image access immediately returns `404`.

## Rollback

Application rollback is a container-image rollback. Database rollback is not automatic after writes begin: freeze writes, reconcile any new donation/payment rows, and follow the migration recovery decision. Never downgrade the schema while the newer application has accepted writes.
