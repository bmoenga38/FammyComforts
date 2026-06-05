# Testing — SommyComfort

The test harness foundation (Story 1.11). **Vitest** is the single runner across the workspace.

## Run

```bash
pnpm test            # all packages, via Turborepo
pnpm --filter @sommycomfort/shared test
pnpm --filter @sommycomfort/web test
pnpm --filter @sommycomfort/api test
```

## What runs today (unit + component)

| Package | Tooling | Covers |
|---|---|---|
| `@sommycomfort/shared` | Vitest (node) | money utils (`toCents`/`fromCents`/`formatKes`), constants |
| `@sommycomfort/web` | Vitest + React Testing Library + jsdom | components, e.g. `ThemeToggle` (toggle + persistence) |
| `@sommycomfort/api` | Vitest + `unplugin-swc` (NestJS decorators + metadata) | unit specs (`*.spec.ts`) |

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
- **Tests resolve `@sommycomfort/shared` from source (via Vite), not the built `dist/`** that runtime uses. The `turbo test → ^build` dependency keeps builds fresh, but tests validate source, not the published artifact.
- **`@swc/core` / `esbuild` native build scripts are in `ignoredBuiltDependencies`.** They use prebuilt binaries and work here; **verify on the CI base image** (esp. musl/Alpine or non-x64) when CI lands (Story 1.9) — remove from the ignore list if the prebuilt binary is unavailable there.
- **`unplugin-swc` (api) is configured for constructor-DI only.** Before Epic 2, add tsconfig path-alias resolution and a `class-validator` DTO smoke test to catch decorator-metadata regressions for property injection / validation.
- **`packages/db` has no `test` script yet** — add one when it gains code in Story 1.8 so `pnpm test` covers it.

## Out of scope here

- E2E / browser tests (Playwright) → CI, Story 1.9.
- The gate tests themselves → authored within their respective epics.
