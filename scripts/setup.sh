#!/usr/bin/env bash
# Development bootstrap only; production provisioning and secret management
# belong to the deployment environment.
set -e
cp -n .env.example .env || true
docker compose up -d
pnpm install
pnpm db:generate
printf '\nHarambeeOne local dependencies are ready. Next: pnpm db:migrate && pnpm db:seed && pnpm dev\n'

