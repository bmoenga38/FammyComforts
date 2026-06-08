---
baseline_commit: cb5faa03fec9293f4fb5676429ca9365e8528788
---

# Story 1.9: CI/CD pipeline and containerized deploy

Status: done

> **⚠️ PARTIALLY SUPERSEDED — Convex (2026-06-08).** The backend-deploy parts of this story are superseded: the **`apps/api/Dockerfile`**, the `postgres`/`redis`/`minio` services in `docker-compose.yml`, and the **`prisma migrate deploy`** job no longer apply — the Convex backend ships via **`convex deploy`** (dev `quixotic-boar-465` / prod `notable-cod-441`), gated on `CONVEX_DEPLOY_KEY`. **Still valid:** the web CI gates (lint/typecheck/Vitest/Playwright), the web Dockerfile (if self-hosting the Next app), and `DEPLOY.md`'s structure. Update `deploy.yml` to a `convex deploy` step (replacing build-images→migrate) when wiring real deploys. See the Backend Platform Addendum in `architecture.md`.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want automated checks and reproducible deploys,
so that changes ship safely.

> **Right-scoped (config-authoring story; execution lives off-box).** This story's deliverable is **the CI/CD + container configuration**. None of it executes in this environment — there is no GitHub runner, no Docker daemon, no Playwright browsers, and no deploy host/registry/secrets. So the honest split is:
> - **Authored + locally verifiable now:** the GitHub Actions workflows (YAML valid, steps mirror the already-green `pnpm lint/typecheck/test/build`), the Playwright config + a smoke e2e spec (typecheck/lint clean), the per-app Dockerfiles, `docker-compose.yml`, and `.dockerignore`s.
> - **Deferred to real infra (documented):** the pipeline actually *running* on GitHub, building/pushing Docker **images**, applying **`prisma migrate deploy`** against a real DB, and the **deploy** to a host — all need a GitHub repo + container registry + managed Postgres + secrets that don't exist here. The migrate step also needs the Prisma engines build-script approved (carried from 1.8).

## Acceptance Criteria

1. **PR CI gate (AR8).** A GitHub Actions workflow triggers on pull requests (and pushes) and runs **lint, typecheck, Vitest, and a build**, plus a **Playwright** e2e job — all on Node 24 + pnpm 10 with a frozen lockfile. Job failures fail the workflow (so branch protection can block merge). The check commands are exactly the repo's existing green scripts (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`), so CI mirrors local.
2. **Playwright wired (AR8).** `@playwright/test` is added to `apps/web` with a `playwright.config.ts` (its own `testDir`, a `webServer` that builds+serves the app) and at least one smoke e2e spec (the app loads and a workspace renders). Playwright specs live outside the Vitest glob so the two runners don't collide. A `test:e2e` script exists. (Browser download + actual run happen in CI / when browsers are installed — deferred locally.)
3. **Dockerfiles per app (AR8).** `apps/web/Dockerfile` and `apps/api/Dockerfile` are multi-stage, pnpm + Turborepo aware, run `prisma generate`, and produce runnable images (web served via `next start`/standalone, api via `node dist/main`). `.dockerignore` files keep build context lean. (Built/pushed in CI — not buildable here.)
4. **Local dev compose.** `docker-compose.yml` defines the local stack from the architecture — **postgres, redis, minio**, plus optionally api + web — with sensible env wiring to `DATABASE_URL` etc., so a developer can `docker compose up` the backing services. (Not run here.)
5. **Deploy pipeline = migrate-then-deploy (AR8).** A workflow triggered on merge to `main` **builds Docker images per app**, then runs a **`prisma migrate deploy`** step that applies migrations **before** the release/deploy step. Image push + deploy + migrate are gated on repository **secrets** (registry creds, `DATABASE_URL`, host creds) and are clearly documented as requiring infra provisioning; the workflow structure + ordering (migrate → deploy) is correct and reviewable.
6. **Green + no regressions.** Adding `@playwright/test` + the config/spec/Docker files does not break `pnpm lint/typecheck/test/build` (Vitest must not pick up Playwright specs; tsc/eslint must stay clean). The workflow YAML is valid. A short `DEPLOY.md` (or section) documents the pipeline, required secrets, and the deferred-execution items.

> Out of scope: provisioning the actual host/registry/managed DB, real secrets, running the pipeline, building/pushing images, applying migrations to a live DB, CDN/Sentry/uptime wiring (later/ops). This story authors and locally-verifies the configuration only.

## Tasks / Subtasks

- [x] **Task 1: CI workflow** (AC: #1) — `.github/workflows/ci.yml`: trigger on `pull_request` + `push` (branches: main). Jobs on `ubuntu-latest`, Node **24**, pnpm **10.33.0** via `pnpm/action-setup` + `actions/setup-node` (cache pnpm). Steps: `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. A separate `e2e` job runs Playwright (install browsers `--with-deps`, then `pnpm --filter @sommycomfort/web test:e2e`). Concurrency-cancel in-progress for the same ref.
- [x] **Task 2: Playwright setup** (AC: #2, #6) — add `@playwright/test` (devDep) to `apps/web`; `apps/web/playwright.config.ts` (`testDir: "./e2e"`, `webServer` building + `next start` on a test port, `baseURL`, chromium project); `apps/web/e2e/smoke.spec.ts` (visit `/` → redirected to `/guest`, assert the "Guest Booking" heading / a nav link is visible); add `"test:e2e": "playwright test"` script. Ensure `e2e/**` is outside the Vitest `include` (it is: `src/**`) and that tsc/eslint accept the new files (add `@playwright/test` types; lint-clean).
- [x] **Task 3: Dockerfiles + dockerignore** (AC: #3) — `apps/web/Dockerfile` + `apps/api/Dockerfile`: multi-stage (deps → build → runtime), pnpm via corepack, copy workspace, `pnpm install --frozen-lockfile`, `prisma generate`, `pnpm --filter <app> build`, slim runtime image running the app. Add `apps/web/.dockerignore`, `apps/api/.dockerignore`, and/or a root `.dockerignore` excluding `node_modules`, `.next`, `dist`, `.git`, test artifacts.
- [x] **Task 4: docker-compose (local dev)** (AC: #4) — root `docker-compose.yml` with `postgres:18`, `redis:8`, `minio` (console + api ports, default creds), volumes, healthchecks, and a `.env`-driven `DATABASE_URL`. Document `docker compose up` in `DEPLOY.md`. (api/web app services optional — at least the backing services.)
- [x] **Task 5: Deploy workflow (migrate-then-deploy)** (AC: #5) — `.github/workflows/deploy.yml`: trigger on `push` to `main` (after CI). Build images per app (build only, or build+push to a registry referenced via `secrets`), then a `migrate` job/step running `pnpm --filter @sommycomfort/db exec prisma migrate deploy` using `secrets.DATABASE_URL`, **then** a `deploy` step (host-specific, secret-gated, documented as a placeholder). Make migrate a dependency of deploy (ordering enforced). Comment where secrets/infra must be filled in, and note the Prisma engines build-script approval needed for migrate.
- [x] **Task 6: Docs + verify** (AC: #5, #6) — `DEPLOY.md`: pipeline overview (PR gates → main → migrate → deploy), required GitHub **secrets** list, local `docker compose` usage, and the deferred-execution checklist (run on GitHub, build/push images, real migrate, real deploy, approve Prisma engines). Validate every workflow YAML parses; run `pnpm lint/typecheck/test/build` — all stay green. Update `TESTING.md` to mention the CI gates + Playwright (closes the 1.5 "CI SW smoke" + 1.3 "automated contrast/axe in CI" follow-ups where reasonable, or note them).

## Dev Notes

### Architecture compliance
- **AR8 (binding):** GitHub Actions — **lint + typecheck + Vitest + Playwright on PR**; **Docker images per app**; **migrate-then-deploy** on main. [Source: epics.md AR8]
- **Infrastructure & Deployment:** Containerization = Docker images per app; **`docker-compose.yml` for local dev (postgres, redis, minio, api, web)**. Hosting MVP = containers on a VPS or PaaS (Render/Railway/Fly.io); managed Postgres + Redis; **S3-compatible** storage (MinIO in dev). Web behind a CDN. CI/CD = **lint+typecheck+Vitest+Playwright on PR; build+push images+migrate+deploy on main**. Config = typed env via Zod, secrets via the platform secret store, **`.env.example` committed**. Observability (pino, Sentry, health) — health endpoint already exists (`/api/v1/health`, Story 1.8). [Source: architecture.md#Infrastructure-&-Deployment]
- **Toolchain pins:** Node **24** (`.nvmrc` = `24`, `engines.node >=24`), **pnpm 10.33.0** (`packageManager`), Turborepo. CI must match these exactly. [Source: package.json, .nvmrc]

### What already works (CI must mirror, not reinvent)
- `pnpm lint` (3–4 tasks), `pnpm typecheck` (6), `pnpm test` (Vitest: shared/db/api/web), `pnpm build` (4; web uses `next build --webpack` so the Serwist SW emits — Story 1.5) are **all green today**. CI just runs these via Turbo. [Source: Stories 1.1–1.8 verification]
- **Prisma client** is generated by `packages/db` `postinstall` (`prisma generate`) — runs on `pnpm install` in CI with no DB needed (Prisma 7 driver-adapter/queryCompiler). The blocked `@prisma/engines`/`prisma` build scripts do NOT affect generate/build/test — they ARE needed for **`prisma migrate`** (deploy job) → approve them on the CI/deploy runner. [Source: Story 1.8 + deferred-work]
- The api boots without a DB (health → `db:"down"`); a Playwright/e2e against the **web** app does not require the DB. [Source: Story 1.8 smoke]

### Playwright — keep it off the Vitest path
- Vitest `include` is `src/**/*.test.{ts,tsx}` (web) — put e2e in `apps/web/e2e/*.spec.ts` so Vitest never runs them and Playwright owns them. [Source: apps/web/vitest.config.ts]
- `playwright.config.ts` `webServer`: build once then `pnpm --filter @sommycomfort/web start` (port e.g. 3100), `reuseExistingServer: !process.env.CI`. Use chromium only for the smoke (keep CI fast). The smoke asserts `/` redirects to `/guest` and the shell renders (Story 1.7). **Browsers are installed in CI** (`npx playwright install --with-deps chromium`) — do NOT attempt to download/run browsers locally in dev-story; verify only that the config + spec typecheck and lint.
- eslint/tsc will see the new TS files — ensure they're clean (the web eslint flat config + tsconfig). If the web tsconfig would type-check `e2e/**`, that's fine once `@playwright/test` is installed.

### Docker notes
- **web:** Next 16 + Serwist. Simplest correct runtime = full `.next` + `next start` (Node). `output: "standalone"` is an optimization but changes the build — do **not** flip it in `next.config.ts` now (risk to the verified `--webpack` build); note standalone as a follow-up. Build inside the image with `pnpm --filter @sommycomfort/web build`.
- **api:** Nest build → `apps/api/dist/main.js`; runtime `node dist/main.js`. Needs `prisma generate` before build (the `@sommycomfort/db` postinstall handles it on install).
- Multi-stage + pnpm: use `corepack enable` and `pnpm install --frozen-lockfile`; copy the whole workspace (Turbo needs it) or use `pnpm deploy`/`turbo prune` (note prune as an optimization). **Cannot build here (no Docker)** — author carefully; build verification is deferred to CI.

### Project Structure Notes
- **New:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`; `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`; `apps/web/Dockerfile`, `apps/api/Dockerfile`; `.dockerignore`(s); `docker-compose.yml`; `DEPLOY.md`.
- **Modified:** `apps/web/package.json` (`@playwright/test` devDep + `test:e2e` script); possibly `apps/web/tsconfig.json` / eslint ignores if e2e needs scoping; `TESTING.md` (CI gates section); `pnpm-lock.yaml`.
- No app source/runtime behavior changes — this is infra/config only; existing gates must stay green.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.9, AR8] — CI gates + migrate-then-deploy.
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-&-Deployment] — Docker per app, docker-compose (postgres/redis/minio), PaaS hosting, GitHub Actions, secrets, `.env.example`.
- [Source: package.json, .nvmrc] — Node 24, pnpm 10.33.0, Turborepo scripts.
- [Source: apps/web/vitest.config.ts, apps/web/next.config.ts] — Vitest glob (keep e2e separate), `next build --webpack` (SW emit).
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — 1.8 (approve Prisma engines for migrate; live DB), 1.5 (CI SW smoke), 1.3 (axe/contrast in CI).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- Locally verifiable parts only (no Docker/GitHub/Playwright-browsers here): `pnpm typecheck` 6/6 (Playwright config + e2e spec compile under the web tsconfig once `@playwright/test` is installed), `pnpm lint` 4/4 (config + spec lint-clean), `pnpm test` 6/6 — **web still 13 files / 36 tests** (the `e2e/*.spec.ts` is correctly NOT picked up by Vitest's `src/**` glob), `pnpm build` 4/4.
- No YAML parser available locally (PyYAML / `yaml` / `js-yaml` all absent) → workflow + compose YAML validated by inspection; GitHub/`docker compose` will validate on first real run.
- CI `verify` commands are byte-for-byte the green local scripts; the `e2e` job adds chromium install + web build before `test:e2e`.

### Completion Notes List

- **All 6 ACs satisfied as a config-authoring story** (execution deferred to real infra; documented in `DEPLOY.md` + deferred-work).
- **AC1 — CI gate:** `.github/workflows/ci.yml` (PR + push→main, concurrency-cancel). `verify` job = install→lint→typecheck→test→build on Node 24 + pnpm via `pnpm/action-setup` (reads `packageManager`). Separate `e2e` job. Both must pass → branch protection blocks merge.
- **AC2 — Playwright:** `@playwright/test` devDep + `apps/web/playwright.config.ts` (`testDir: ./e2e`, chromium, `webServer` = `next start` on :3100, `reuseExistingServer: !CI`) + `apps/web/e2e/smoke.spec.ts` (`/`→`/guest`, asserts the "Guest Booking" h1 + a sidebar link) + `test:e2e` script. Specs sit outside the Vitest glob (verified: web test count unchanged). Browser download/run happen in CI only.
- **AC3 — Dockerfiles:** `apps/{api,web}/Dockerfile` — multi-stage (base→build→runtime), corepack pnpm, `--frozen-lockfile`, `prisma generate` (api), `pnpm --filter <app> build`; runtime runs `node apps/api/dist/main.js` (:3001) / `next start` (:3000). Root `.dockerignore` trims context (node_modules/.next/dist/.turbo/_bmad/etc). standalone + prune noted as optimizations.
- **AC4 — compose:** `docker-compose.yml` with `postgres:18` (+ healthcheck), `redis:8` (+ healthcheck), `minio` (S3 + console), named volumes.
- **AC5 — migrate-then-deploy:** `.github/workflows/deploy.yml` (push→main): `images` (build api + web via buildx, `push:false` until registry secrets) → `migrate` (`prisma migrate deploy` w/ `secrets.DATABASE_URL`) → `deploy` (release placeholder). `deploy needs: migrate` enforces migrations-before-release.
- **AC6 — green + docs:** all four gates green; `DEPLOY.md` documents the pipeline, required secrets, local compose, and the deferred-execution checklist; `TESTING.md` gained a CI-gates + Playwright section. No app runtime behavior changed.
- **Deferred (recorded):** running the pipeline on GitHub; building/pushing images (no Docker here); `prisma migrate deploy` against a real DB **+ approving the Prisma engines build script** on the runner; the actual host rollout; standalone/prune image slimming.

### File List

**New:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`; `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`; `apps/api/Dockerfile`, `apps/web/Dockerfile`; `.dockerignore`; `docker-compose.yml`; `DEPLOY.md`
**Modified:** `apps/web/package.json` (`@playwright/test` + `test:e2e`), `TESTING.md` (CI section), `pnpm-lock.yaml`
**Modified (tracking):** `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

| Date | Change |
|---|---|
| 2026-06-08 | Story drafted (create-story), right-scoped: config authored + locally verified; pipeline execution / image build / migrate / deploy deferred to real infra. |
| 2026-06-08 | Implemented: CI workflow (verify + e2e), Playwright config + smoke spec, per-app Dockerfiles + `.dockerignore`, `docker-compose.yml`, migrate-then-deploy workflow, `DEPLOY.md`, TESTING.md CI section. All gates green (typecheck 6/6, lint 4/4, test 6/6, build 4/4); Vitest unaffected by Playwright specs. Status → review. |
| 2026-06-08 | Code review (3 adversarial layers) + fixes: Dockerfiles build via Turbo (`^build` ordering — fixes the would-fail in-image build of `@sommycomfort/db`/`shared` dist); deploy `migrate`/`deploy` gated behind `vars.DEPLOY_ENABLED` + `workflow_dispatch` (no spurious main-push failures / DB mutation); DEPLOY.md documents the gate + the "no migration committed yet" reality. Status → done. |

## Senior Developer Review (AI)

**Date:** 2026-06-08 · **Reviewer:** Claude Opus 4.8 (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor) · **Outcome:** Approved with fixes applied.

Scope: the Story 1.9 config files (CI/CD workflows, Playwright config + smoke spec, Dockerfiles, `.dockerignore`, compose, DEPLOY.md) + the `apps/web/package.json` / `TESTING.md` edits. This is a config-authoring story — execution (GitHub run, Docker build, live migrate, deploy, browser e2e) is environment-blocked and deferred. pnpm gates unaffected by the fixes (no TS/build inputs changed): typecheck 6/6, lint 4/4, test 6/6, build 4/4.

### Review Findings

**Patches (applied):**

- [x] [Review][Patch][High] Dockerfiles built the app with `pnpm --filter <app> build`, skipping Turbo's `^build` graph → `@sommycomfort/db`/`shared` `dist/` never compiled, so the in-image `nest build`/`next build` would fail on the missing workspace dist (the 1.1 "direct-tsc-before-build" gotcha). Now build via `pnpm exec turbo run build --filter=<app>` (deps build first; db's build runs `prisma generate` + tsc) [apps/api/Dockerfile, apps/web/Dockerfile]
- [x] [Review][Patch][Med] `deploy.yml` ran `migrate`/`deploy` on every push to `main` → spurious failures + unintended DB mutation before infra exists. Gated both jobs behind `vars.DEPLOY_ENABLED == 'true'` and added `workflow_dispatch`; `images` still builds on push (validates Dockerfiles), DB/deploy stay off until intentionally enabled [.github/workflows/deploy.yml]
- [x] [Review][Patch][Low] DEPLOY.md now documents the `DEPLOY_ENABLED` gate and that `migrate deploy` is a no-op until the first migration is committed [DEPLOY.md]

**Deferred (genuinely environment-blocked, tracked in deferred-work.md):**

- [x] [Review][Defer][High] No `packages/db/prisma/migrations/` exists → `prisma migrate deploy` applies nothing until the initial `audit_logs` migration is authored against a real DB (`db:migrate` needs a shadow DB). Can't be created here (no Postgres). Documented in DEPLOY.md + deferred-work (ties to the 1.8 live-DB deferral).
- [x] [Review][Defer][Med] Prisma engines build-script approval for the migrate runner — stays a documented step (the migrate job is now gated off, so it won't fire spuriously); approve on the runner when enabling deploy.

**Dismissed (≈6):** api image "crashes without DATABASE_URL" (false — 1.8 made it boot with `db:"down"`); `uuidv7()` (native in PostgreSQL 18 ✓); Node not patch-pinned, `e2e` job rebuilds web (acceptable), compose hardcoded local-only creds, Playwright `webServer` cwd coupling (documented); compose omitting api+web services (AC4 explicitly made them optional); branch-protection "blocks merge" is inherently repo config (documented in DEPLOY.md), not workflow-enforceable.
