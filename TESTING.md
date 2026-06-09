# Testing — Fammy Comforts

The test harness foundation (Story 1.11). **Vitest** is the single runner across the workspace.

## Run

```bash
pnpm test            # all packages, via Turborepo
pnpm --filter @fammycomforts/shared test
pnpm --filter @fammycomforts/web test
pnpm --filter @fammycomforts/api test
```

## What runs today (unit + component)

| Package | Tooling | Covers |
|---|---|---|
| `@fammycomforts/shared` | Vitest (node) | money utils (`toCents`/`fromCents`/`formatKes`), constants |
| `@fammycomforts/web` | Vitest + React Testing Library + jsdom | components, e.g. `ThemeToggle` (toggle + persistence) |
| `@fammycomforts/api` | Vitest + `unplugin-swc` (NestJS decorators + metadata) | unit specs (`*.spec.ts`) |

`unplugin-swc` is required for the api because esbuild (Vitest's default transform) does not emit decorator metadata, which NestJS DI needs.

## Integration (DB-backed) — activates in Story 1.8

There is **no DB-backed code yet** (Prisma + schema land in Story 1.8), and this dev environment has **no Docker/Postgres**, so live integration tests are **not** wired today. When the data layer lands, add:

- **Ephemeral Postgres** per run — Testcontainers (preferred, needs Docker) or a disposable schema against a CI Postgres service.
- A **seed/factory layer** for fixtures, isolated per test.
- **Injection seams** so external/non-deterministic deps are fakeable: a `Clock` interface (no `new Date()` in domain code) and an `MpesaGateway` interface (no real Daraja calls in tests).

## Mandatory CI gates (from the party-mode plan review)

These are **hard gates** — the listed tests must exist and pass before the named work merges (enforced by CI, Story 1.9):

- **Before the first Epic 5 payment story:** integration tests for M-Pesa **callback idempotency** (duplicate/out-of-order/late callbacks), **double-spend** prevention, and **ledger-balance invariants** (see `mpesa-daraja-integration-spec.md`).
- **Before the first Epic 4 availability story:** a **concurrency test** firing parallel reservation attempts at the same room (the specific-room double-booking guard / exclusion constraint).
- **Before Epic 2 RBAC:** a **table-driven authorization test** over the role × permission grid, **including negative cases** (role must NOT reach endpoint).

## Known gaps & follow-ups (from the 1.11 code review)

- **Test files are not `tsc`-type-checked in `shared`/`web`** (they're excluded from the build tsconfig and run by Vitest, which strips types). The api's specs *are* type-checked. Deliberate trade-off for a clean `dist` + fast build; revisit with Vitest `test.typecheck` or a `tsconfig.test.json` if test type-safety becomes important.
- **Tests resolve `@fammycomforts/shared` from source (via Vite), not the built `dist/`** that runtime uses. The `turbo test → ^build` dependency keeps builds fresh, but tests validate source, not the published artifact.
- **`@swc/core` / `esbuild` native build scripts are in `ignoredBuiltDependencies`.** They use prebuilt binaries and work here; **verify on the CI base image** (esp. musl/Alpine or non-x64) when CI lands (Story 1.9) — remove from the ignore list if the prebuilt binary is unavailable there.
- **`unplugin-swc` (api) is configured for constructor-DI only.** Before Epic 2, add tsconfig path-alias resolution and a `class-validator` DTO smoke test to catch decorator-metadata regressions for property injection / validation.
- **`packages/db` has no `test` script yet** — add one when it gains code in Story 1.8 so `pnpm test` covers it.

## CI gates (Story 1.9)

`.github/workflows/ci.yml` runs on every PR + push to `main` (Node 24, pnpm 10):

- **verify** job: `pnpm lint` → `pnpm typecheck` → `pnpm test` (Vitest) → `pnpm build` — exactly the local scripts.
- **e2e** job: installs chromium, builds web, runs **Playwright** (`pnpm --filter @fammycomforts/web test:e2e`).

Enable branch protection on `main` requiring both jobs so failures block merge. **E2E:** Playwright
specs live in `apps/web/e2e/*.spec.ts` (outside the Vitest `src/**` glob); `apps/web/playwright.config.ts`
serves a production build via `next start`. See `DEPLOY.md` for the full pipeline + deferred-execution notes.

## Out of scope here

- The gate tests themselves → authored within their respective epics.
