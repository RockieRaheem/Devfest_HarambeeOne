FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @harambeeone/web...
COPY . .
ENV HARAMBEEONE_STANDALONE=true
RUN pnpm --dir apps/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S harambeeone && adduser -S harambeeone -G harambeeone
COPY --from=build --chown=harambeeone:harambeeone /repo/apps/web/.next/standalone ./
COPY --from=build --chown=harambeeone:harambeeone /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=harambeeone:harambeeone /repo/apps/web/public ./apps/web/public
USER harambeeone
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
