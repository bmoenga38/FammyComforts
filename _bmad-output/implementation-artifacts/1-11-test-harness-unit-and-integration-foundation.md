---
baseline_commit: 8e152543223d054e9f7dd4f21640e956eee2f979
---

# Story 1.11: Test harness — unit & integration foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a working unit + component test harness with Vitest across the workspace, plus a documented integration-DB pattern ready to activate when the data layer lands,
so that the high-risk money, availability, and RBAC code (Epics 2, 4, 5) is built test-first and protected by regression tests.

> **Build-order gate (party-mode review, Murat/Amelia):** hard prerequisite for Epic 2 — must be `done` before RBAC, availability, or payment code.
>
> **Environment reality (verified 2026-06-05):** this dev environment has **no Docker and no Postgres**, and **no DB-backed code exists yet** (Prisma + schema is Story 1.8). Therefore live ephemeral-Postgres integration tests are **scaffolded + documented now but activated in Story 1.8** — there is literally nothing DB-backed to integration-test today. The **unit + component** harness is built and runs fully now. The Epic 2/4/5 CI gates below remain mandatory and will be satisfied (with Docker/Postgres) when those epics are built.

## Acceptance Criteria

1. **Vitest across the workspace** — `packages/shared`, `apps/web`, and `apps/api` each have a Vitest config + a `test` script; a root `pnpm test` runs them via the Turborepo `test` task and is green.
2. **Shared unit tests** — `packages/shared` money utilities (`toCents`, `fromCents`, `formatKes`) are unit-tested including rounding/edge cases; tests pass.
3. **Web component testing** — Vitest + React Testing Library + jsdom configured for `apps/web`; a test for `ThemeToggle` verifies it renders, toggles `<html data-theme>`, and persists to `localStorage`; passes.
4. **API on Vitest** — the api's Jest scaffold is replaced by Vitest with NestJS decorator/metadata support (e.g. `unplugin-swc` + `@swc/core`); the existing `app.controller` test is converted and passes under Vitest.
5. **Integration-DB pattern scaffolded + documented** — a `TESTING.md` (or section) documents the integration approach (ephemeral Postgres via Testcontainers OR disposable schema, a seed/factory layer, injection seams for clock + M-Pesa gateway) and states clearly it **activates in Story 1.8**. No fake/empty DB tests are committed.
6. **CI gates carried forward** — `TESTING.md` restates the mandatory gates: before Epic 5 first payment story → callback-idempotency + double-spend + ledger-invariant integration tests; before Epic 4 first availability story → a concurrency test; before Epic 2 RBAC → a table-driven authorization grid (incl. negative cases). Story 1.9 (CI) will run `pnpm test`.
7. **Green** — `pnpm test`, `pnpm build`, `pnpm typecheck`, `pnpm lint` all pass.

> Out of scope: live DB integration tests (→ Story 1.8), Playwright/E2E (→ CI, Story 1.9), and the actual gate tests for money/availability/RBAC (→ their epics).

## Tasks / Subtasks

- [x] **Task 1: Shared package — Vitest + money tests** (AC: #1, #2)
  - [x] Add `vitest` to `packages/shared`; `vitest.config.ts`; `test` script (`vitest run`)
  - [x] `src/index.test.ts` — `toCents`, `fromCents`, `formatKes` incl. rounding (e.g. 3500 → 350000; 0.1 handling; negative; large)
- [x] **Task 2: Web — Vitest + RTL + jsdom** (AC: #1, #3)
  - [x] Add `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` to `apps/web`
  - [x] `vitest.config.ts` (jsdom env, react plugin, setup file with jest-dom matchers, path alias `@/*`); `test` script
  - [x] `src/components/theme-toggle.test.tsx` — renders; click toggles `document.documentElement.dataset.theme` dark⇄light; writes `localStorage['sommycomfort-theme']`
- [x] **Task 3: API — replace Jest with Vitest** (AC: #1, #4)
  - [x] Remove jest config/deps (`jest`, `ts-jest`, `@types/jest`, jest block) from `apps/api`; add `vitest`, `unplugin-swc`, `@swc/core`
  - [x] `vitest.config.ts` using `unplugin-swc` (decorators + emitDecoratorMetadata), globals on; update `test` script
  - [x] Convert `src/app.controller.spec.ts` to Vitest (works as-is with globals; adjust imports if needed); passes
- [x] **Task 4: Turborepo wiring** (AC: #1)
  - [x] Add a `test` task to `turbo.json` (`dependsOn: ["^build"]`, cache outputs none/coverage); root `package.json` `"test": "turbo run test"`
- [x] **Task 5: Document integration pattern + gates** (AC: #5, #6)
  - [x] `TESTING.md` at repo root (or `docs/`): unit/component setup, the integration-DB approach (Testcontainers/disposable schema + factory/seed + clock/gateway seams), the "activates in Story 1.8" note, and the Epic 2/4/5 CI gates
- [x] **Task 6: Verify** (AC: #7)
  - [x] `pnpm test` green (all three packages), `pnpm build` / `pnpm typecheck` / `pnpm lint` green; capture counts in Dev Agent Record

## Dev Notes

- **Standardize on Vitest** (architecture mandates Vitest). The api came from `nest new` with **Jest** — replace it. Nest needs decorators + `emitDecoratorMetadata`; Vitest via esbuild doesn't emit decorator metadata, so use **`unplugin-swc`** (`@swc/core`) in the api's `vitest.config.ts` — the standard Nest+Vitest recipe. The current api has only `AppController`/`AppService` (trivial DI), so this should be smooth.
- **No Docker/Postgres here** → don't add Testcontainers as a hard dependency that breaks `pnpm test`. Document it for Story 1.8; keep today's suite DB-free and fast.
- **What's actually testable today:** `packages/shared` money utils (real logic), and `apps/web` `ThemeToggle` (real behavior via jsdom). `apps/api` has only the sample controller — convert its spec so the api runner is proven, but don't invent api logic to test.
- **Tailwind v4 note:** component tests don't need Tailwind compiled — RTL asserts DOM/behavior, not computed styles. jsdom doesn't do layout/CSS.
- **ThemeToggle test specifics:** it uses `useSyncExternalStore` reading `document.documentElement.dataset.theme`; in jsdom, set/get that attribute. Simulate click via `@testing-library/user-event`; assert attribute flip + `localStorage` write. The custom-event dispatch keeps the hook in sync.
- **Keep configs consistent** with the `packages/config` presets where practical; don't fight the framework defaults.

### Project Structure Notes

- New: `packages/shared/{vitest.config.ts,src/index.test.ts}`, `apps/web/{vitest.config.ts,vitest.setup.ts,src/components/theme-toggle.test.tsx}`, `apps/api/vitest.config.ts`, root `TESTING.md`.
- Modified: `apps/api/package.json` (jest→vitest), `apps/web/package.json` + `packages/shared/package.json` (deps + `test` script), `turbo.json` (`test` task), root `package.json` (`test`), convert `apps/api/src/app.controller.spec.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.11] — story + ACs + CI gates
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-&-Deployment] — Vitest unit, Playwright e2e, Supertest integration
- [Source: _bmad-output/planning-artifacts/mpesa-daraja-integration-spec.md] — the idempotency/double-spend cases the Epic 5 gate must cover
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — testability concerns from the 1.2 review
- [Source: apps/api/package.json] — current Jest scaffold being replaced

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- `pnpm test` → **4/4 tasks, 9 tests pass**: shared 5 (money utils), web 3 (ThemeToggle via RTL+jsdom), api 1 (Nest controller via Vitest+SWC).
- `pnpm build` 4/4 · `pnpm typecheck` 5/5 · `pnpm lint` 3/3 — harness changes broke nothing.
- NestJS + Vitest worked first try with `unplugin-swc` (`legacyDecorator` + `decoratorMetadata`) — DI in `Test.createTestingModule` resolved correctly.

### Completion Notes List

- **All 7 ACs satisfied** for the right-scoped (no-Docker) version. Vitest is the single runner workspace-wide.
- **Caught a latent bug:** the Nest sample spec still asserted `'Hello World!'`, but Story 1.1 changed `getHello()` to return `'Hello from Fammy Comforts API!'` — the old assertion would have failed the moment any test ran. Converted + corrected.
- **API migrated Jest → Vitest:** removed `jest`/`ts-jest`/`@types/jest` + the jest config block + the e2e scaffold (`test/`); added `vitest` + `unplugin-swc` + `@swc/core`. Decorators/metadata handled by SWC (esbuild alone can't).
- **Integration (DB) tests deferred to Story 1.8** — documented in `TESTING.md` with the Testcontainers/disposable-schema pattern, factory/seed layer, and clock + M-Pesa-gateway injection seams. The mandatory CI gates (idempotency/double-spend/ledger before Epic 5; concurrency before Epic 4; RBAC grid before Epic 2) are recorded there.
- **Config hygiene:** test files excluded from the app/package `tsc` configs (build/typecheck) and run by Vitest instead — keeps `dist` clean and build fast (tests are executed, not tsc-typechecked; acceptable for the foundation). `nest build` already excludes specs; added `vitest.config.ts` to the api build exclude. Added `@swc/core`/`esbuild` to `ignoredBuiltDependencies` (prebuilt binaries work without their postinstall — tests prove it).
- Test counts to grow as money/RBAC/booking land, gated per `TESTING.md`.

### File List

**New:** `packages/shared/{vitest.config.ts,src/index.test.ts}`, `apps/web/{vitest.config.ts,vitest.setup.ts,src/components/theme-toggle.test.tsx}`, `apps/api/vitest.config.ts`, `TESTING.md`
**Modified:** `packages/shared/{package.json,tsconfig.json}`, `apps/web/{package.json,tsconfig.json}`, `apps/api/{package.json,tsconfig.build.json,src/app.controller.spec.ts}`, `turbo.json`, root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
**Deleted:** `apps/api/test/app.e2e-spec.ts`, `apps/api/test/jest-e2e.json` (jest e2e scaffold; e2e → Story 1.9)
**Modified (tracking):** `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
|---|---|
| 2026-06-05 | Story drafted + right-scoped for the no-Docker env (unit/component now, integration pattern documented for Story 1.8). |
| 2026-06-05 | Implemented: Vitest workspace-wide (shared/web/api), api migrated Jest→Vitest via unplugin-swc, RTL+jsdom for web, money + ThemeToggle tests, TESTING.md with integration pattern + CI gates. 9 tests green; build/typecheck/lint green. Status → review. |
| 2026-06-05 | Code review (Edge Case + Acceptance). Auditor: all 7 ACs satisfied. Applied 3 patches (explicit reflect-metadata in api; +2 ThemeToggle tests for cross-tab/storage + setItem-throws → 11 tests; removed leftover globals.jest). 5 items deferred to TESTING.md/deferred-work. Re-verified green. Status → done. |

## Senior Developer Review (AI)

**Date:** 2026-06-05 · **Reviewer model:** claude-opus-4-8[1m] · **Layers:** Edge Case Hunter, Acceptance Auditor (Blind Hunter skipped — low value on test config) · **Outcome:** ✅ Approve (Auditor: all 7 ACs satisfied)

### Action Items

- [x] [Review][Patch][Med] `reflect-metadata` was loaded only via Nest's transitive import (load-order luck) → added explicit `setupFiles: ["reflect-metadata"]` to `apps/api/vitest.config.ts` + `import 'reflect-metadata'` in `main.ts`.
- [x] [Review][Patch][Low] `ThemeToggle` cross-tab (`storage` event) and `setItem`-throws branches (added in the 1.2 review) were untested → added 2 tests; web suite now 5 tests.
- [x] [Review][Patch][Low] Leftover `globals.jest` in `apps/api/eslint.config.mjs` (Nest scaffold remnant) → removed.
- [x] [Review][Defer] Test files aren't `tsc`-type-checked in shared/web (run by Vitest); api specs are. Deliberate trade-off → documented in TESTING.md "Known gaps."
- [x] [Review][Defer] `unplugin-swc` configured for constructor-DI only → before Epic 2, add tsconfig path-alias resolution + a `class-validator` DTO smoke test. (→ deferred-work / TESTING.md)
- [x] [Review][Defer] `@swc/core`/`esbuild` in `ignoredBuiltDependencies` — verify on the CI base image (musl/non-x64) at Story 1.9. (→ TESTING.md)
- [x] [Review][Defer] `packages/db` has no `test` script → add when it gains code in Story 1.8. (→ TESTING.md)
- [x] [Review][Defer] Tests resolve `@fammycomforts/shared` from source, not built `dist` → noted in TESTING.md.
- [x] [Review][Dismiss] NodeNext extensionless import in shared test (cosmetic); version pinning (clean, no peer issues).

**Post-fix verification:** `pnpm test` = **11 tests / 4 tasks green** (shared 5, web 5, api 1) · `pnpm build` 4/4 · `pnpm lint` 3/3.
