# Donation demo deployment runbook

HarambeeOne's donation experience is production-build and container ready, while the Stellar rail remains explicitly testnet-only. Testnet XLM has no monetary value and must never be described as a real fiat settlement.

## Zero-cost boundary

Do not enable Firebase Cloud Storage for campaign images: current Firebase projects require the Blaze billing plan. Approved images are therefore resized, metadata-stripped, re-encoded and stored under a strict size limit in the existing PostgreSQL database.

Firebase Hosting on Spark can host static assets, but it cannot run the current FastAPI service or the server-rendered Next.js gateway. Firebase App Hosting and Cloud Run require a billing account. Until the user explicitly changes the zero-cost rule, use the verified local demo or a genuinely free container host that does not require a payment method. Do not attach billing merely to deploy.

## Required runtime configuration

Set secrets only in the hosting provider's encrypted environment configuration. Never bake them into either image.

- Web: `API_URL`, Firebase public web configuration, `NODE_ENV=production`.
- API: database provider settings, Firebase Admin application-default credentials, Gemini key when enabled, `NODE_ENV=production`, and `CORS_ALLOWED_ORIGINS=https://YOUR_WEB_HOST`.
- Stellar: `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org`, `STELLAR_DEMO_UGX_PER_XLM=1000`, and `STELLAR_DEMO_FAUCET_ENABLED=false` for every public deployment.

Production validation rejects wildcard or non-HTTPS CORS origins, a Firebase Auth emulator, a non-Firebase auth provider, a non-official Horizon URL, and an enabled Friendbot demo faucet.

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
