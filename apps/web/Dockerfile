# syntax=docker/dockerfile:1
# SommyComfort web (Next.js 16 + Serwist PWA). Multi-stage, pnpm + Turborepo aware.
# Built in CI (AR8) — not buildable in the dev environment (no Docker daemon).
# Build context is the repo root (the monorepo workspace).
# (Optimization, deferred: Next `output: "standalone"` for a slimmer runtime image —
#  not flipped now to avoid risk to the verified `next build --webpack` SW build.)

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

# ---- build: install the full workspace, build the web app via Turbo (SW emits via webpack) ----
# Build through Turbo so workspace deps (shared) compile first per `^build`;
# a direct `pnpm --filter @sommycomfort/web build` would skip them.
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm exec turbo run build --filter=@sommycomfort/web

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@sommycomfort/web", "start"]
