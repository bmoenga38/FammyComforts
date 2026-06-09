# Deployment & CI/CD

Fammy Comforts ships via GitHub Actions (AR8): every PR is gated by checks; every merge to
`main` builds images, applies DB migrations, then releases (migrate-then-deploy).

## Pipelines

### CI — `.github/workflows/ci.yml` (PR + push to main)

| Job | Steps |
|-----|-------|
| **verify** | `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` |
| **e2e** | install chromium → build web → `pnpm --filter @fammycomforts/web test:e2e` (Playwright) |

Runs on Node 24 + pnpm 10 (pinned via `packageManager`). Enable **branch protection** on
`main` requiring both jobs so failures block merge.

### Deploy — `.github/workflows/deploy.yml` (merge to main, or manual `workflow_dispatch`)

`images` (build api + web) → **`migrate`** (`prisma migrate deploy`) → `deploy` (release).
Migrations are always applied **before** the release step (`deploy needs: migrate`).

> **Gated off by default.** `migrate` + `deploy` only run when the repo variable
> **`DEPLOY_ENABLED=true`** is set (plus the secrets below). Until then, pushes to `main`
> build the images (validating the Dockerfiles) but never touch the DB or deploy — so the
> pipeline doesn't fail spuriously before infra exists.
>
> **`migrate deploy` is a no-op until the first migration is committed.** No
> `packages/db/prisma/migrations/` exists yet — generating it needs a real DB
> (`pnpm --filter @fammycomforts/db db:migrate`, which uses a shadow DB). Author + commit
> the initial `audit_logs` migration when a DB is available (tracked in deferred-work).

## Local backing services

```bash
docker compose up -d            # postgres:18, redis:8, minio
cp packages/db/.env.example packages/db/.env   # then set DATABASE_URL if needed
```

- Postgres → `localhost:5432` (user/pw/db: `sommycomfort`)
- Redis → `localhost:6379`
- MinIO → API `localhost:9000`, console `localhost:9001` (`sommycomfort`/`sommycomfort`)

## Container images

Multi-stage Dockerfiles build from the **repo root** context (monorepo):
`apps/api/Dockerfile` (`node apps/api/dist/main.js`, port 3001) and
`apps/web/Dockerfile` (`next start`, port 3000). `.dockerignore` trims the context.

## Required GitHub secrets (set before enabling push/deploy)

| Secret | Used by | Purpose |
|--------|---------|---------|
| `DATABASE_URL` | `migrate` | Postgres connection for `prisma migrate deploy` |
| `REGISTRY_*` (host/user/token) | `images` | push images (flip `push: true`) |
| host/deploy creds | `deploy` | roll out to Render/Railway/Fly.io/VPS |

## Deferred — execution requires infra not present in this environment

This story **authored and locally verified** the config (YAML valid; CI commands mirror the
green `pnpm` scripts; Playwright + Docker files typecheck/lint clean). The following only run
once real infra exists, and are tracked in `_bmad-output/implementation-artifacts/deferred-work.md`:

- The pipeline actually running on GitHub (no runner here).
- Building/pushing Docker **images** (no Docker daemon here) — flip `push: true` + add registry secrets.
- **`prisma migrate deploy`** against a real DB — also requires **approving the Prisma engines build
  script** on the runner (`pnpm approve-builds` / add `prisma` + `@prisma/engines` to
  `onlyBuiltDependencies`); not needed for `generate`/`build`/`test` (Prisma 7 driver adapter).
- The actual **deploy/rollout** to a host (placeholder step today).
- Optional: Next `output: "standalone"` for slimmer web images; `turbo prune`/`pnpm deploy` for slimmer api images.
