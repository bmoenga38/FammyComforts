# syntax=docker/dockerfile:1
# Fammy Comforts API (NestJS). Multi-stage, pnpm + Turborepo aware.
# Built in CI (AR8) — not buildable in the dev environment (no Docker daemon).
# Build context is the repo root (the monorepo workspace).

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

# ---- build: install the full workspace, build the api via Turbo ----
# Build through Turbo so workspace deps (shared, db — db's build runs
# `prisma generate` + tsc) compile FIRST per the `^build` graph. A direct
# `pnpm --filter @fammycomforts/api build` would skip them and fail on the
# missing `@fammycomforts/db` dist.
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm exec turbo run build --filter=@fammycomforts/api

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
# (Optimization, deferred: prune to api + prod deps via `pnpm deploy`/`turbo prune`.)
COPY --from=build /app /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
