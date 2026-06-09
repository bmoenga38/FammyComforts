# Deferred Work

## Deferred from: code review of story-1.1 (2026-06-05)

- **Approve `sharp` (and `unrs-resolver`) native build scripts before image optimization ships.** Currently in `pnpm-workspace.yaml` `ignoredBuiltDependencies`. Harmless now (no `next/image` usage), but `next/image` optimization needs `sharp`'s native binary. Run `pnpm approve-builds` and re-install when the first image feature lands (likely Epic 4 guest catalog).
- **Consider TypeScript project references for `packages/shared` / `packages/db`.** They currently expose types only via built `dist`, so running `tsc` directly in an app *before* a build (outside the Turborepo `^build` ordering) fails to resolve the shared types. Turbo handles this today; project references (or a `dev`-time `types`→`src` condition) would make editor/direct-`tsc` resolution robust if the team ever bypasses turbo.

## Deferred from: code review of story-1.2 (2026-06-05)

- **StatusChip badge backgrounds + per-theme contrast verification.** Story 1.2's demo chips render `text-<status>` on `bg-bg-card` (proof only). The real StatusChip (Story 1.3) should pair each status with its `--badge-*-bg` tint and verify every foreground/background pair meets WCAG contrast (4.5:1) in **both** themes. Note the `--badge-*-bg` tokens are currently dark-palette RGBA literals (per DESIGN_SYSTEM.md) and not theme-adaptive — revisit when building StatusChip (consider `color-mix` so they track the per-theme status color).
- **Cookie-readable theme to eliminate the one-frame toggle-label flash.** Returning light-mode users see the `ThemeToggle`'s own label render `Dark` for one frame before flipping to `Light` (page colors do NOT flash — the inline script handles those; only the button's text/icon). `useSyncExternalStore`'s server snapshot is `dark` because the server can't read `localStorage`. Storing the theme in a cookie (readable during SSR) would let the server render the correct toggle label. Low priority (button-only, sub-frame).

## Deferred from: code review of story-1.11 (2026-06-05)

(Also captured in `TESTING.md` "Known gaps & follow-ups".)

- **Before Epic 2:** extend the api `unplugin-swc` Vitest config with tsconfig **path-alias** resolution and add a **`class-validator` DTO smoke test** — the current config covers constructor-DI only; property injection / DTO validation metadata is the likely first failure.
- **At Story 1.9 (CI):** verify `@swc/core` + `esbuild` work on the CI base image (musl/Alpine or non-x64) — they're in `ignoredBuiltDependencies`; remove from the ignore list if the prebuilt binary isn't available there.
- **At Story 1.8:** add a `test` script to `packages/db` once it gains code, so `pnpm test` covers it.
- **Optional:** decide whether test files should be `tsc`-type-checked (shared/web exclude them; api includes specs) — Vitest `test.typecheck` or a `tsconfig.test.json` would close the gap.

## Deferred from: code review of story-1.3 (2026-06-05)

- **`Table` ergonomics:** add `forwardRef` (to the `<table>`) and a `containerClassName`/`containerRef` for the scroll wrapper, before large/virtualized admin tables land (the stated use case). Today the caller's ref is dropped.
- **`Input` label contract:** add a `Field`/`FormControl` wrapper that owns `label` + `id` + `aria-describedby`/`aria-invalid`, before the Epic-4 guest-details + booking forms (avoid placeholder-as-label across the app).
- **Focus ring color:** `--border-focus` == primary (~3.15:1 in light) meets the 3:1 non-text floor but is weak on a primary-filled button — consider a dedicated, higher-contrast focus color.
- **Automated contrast check:** the AA badge/button ratios were **computed**, not browser-measured (no browser/CI here) — run axe / a contrast checker once CI (Story 1.9) or a browser is available, and consider a contrast snapshot test so it can't regress.
- **`Status` vs `RoomStatus`:** reconcile the 5-value chip `Status` union with the 6-value domain `RoomStatus` (`available·occupied·dirty·cleaning·maintenance·blocked`) so the mapping is explicit when Front-Desk/Housekeeping screens use chips.

## Deferred from: code review of story-1.4 (2026-06-05)

- **Toast UX hardening:** pause auto-dismiss on hover/focus (resume on leave), cap the number of visible toasts (drop oldest), and de-dup identical messages. Important/error toasts should use `durationMs: 0` (already supported).
- **Toast vs fixed mobile action bar:** the bottom-anchored toast region will overlap a fixed bottom action bar once the mobile workspace layout exists (Story 1.7 / feature epics) — offset it by the action-bar height + `env(safe-area-inset-bottom)` then.
- **≥44px tap targets for mobile-ops density:** SegmentedControl segments, the Toast dismiss button, and TaskCard checklist checkboxes are below the 44px floor EXPERIENCE.md mandates for staff phones — add a larger size variant / padded hit areas as the responsive mobile layouts land.
- **CalendarSlot `occupied` vs `booked`:** both map to `info` (cyan) today; give them a distinct visual (icon/border/pattern, not just hue) — a design-system decision touching `DESIGN_SYSTEM.md`.

## Deferred from: story 1.5 (PWA shell)

- **Restore Turbopack builds:** web `build` currently uses `next build --webpack` because the legacy `@serwist/next` plugin doesn't emit the SW under Turbopack. Migrate to `@serwist/turbopack` (or Serwist "configurator" mode) once stable — see `serwist.pages.dev/docs/next/turbo` and serwist#54 — then drop `--webpack`.
- **Production icon set:** replace the SVG icons with a raster PNG set (192 + 512 + maskable) and Apple touch icons once real brand assets exist (needs an image toolchain).
- **Browser/HTTPS verification:** confirm the install prompt + offline SW serving in a real browser; run Lighthouse PWA (the **≥ 90 target is Story 1.6**) and address any gaps.
- **SW update strategy (from 1.5 review):** the SW uses `skipWaiting` + `clientsClaim`, which auto-activates a new SW mid-session (risking chunk-load errors / a surprise reload during, e.g., a check-in). Adopt the "update available → prompt to reload" pattern (use the existing `ToastProvider`) + a `ChunkLoadError` boundary.
- **CI SW smoke (from 1.5 review):** add a CI check (Story 1.9) asserting `public/sw.js` is generated and precaches `/offline`, so the dev(Turbopack, SW-disabled)/prod(webpack) gap can't hide a broken service worker.

## Deferred from: story 1.6 (offline / background sync — right-scoped)

- **Activate functional background sync** when real mutations land (Epic 2+): wire `queryClient.resumePausedMutations()` on reconnect, and add `@tanstack/react-query-persist-client` + a persister (localStorage/IndexedDB) so paused mutations survive reloads. Then write the offline-mutation-queue tests. (Foundation + `PWA.md` are in place from 1.6.)
- **Lighthouse PWA ≥ 90 measurement** (NFR1): run in a real browser/HTTPS or CI (Story 1.9) and close any gaps (may require the PNG icon set). Readiness is in place; only the measurement is outstanding.

## Deferred from: story 1.7 (role-workspace navigation shell)

- **`(guest)` public vs `(staff)` guarded route-group split (Epic 2).** Architecture mandates App-Router route groups `(guest)`/`(staff)` guarded by session + permission. Story 1.7 ships one shared `(app)` group (no auth exists yet). When auth + RBAC land (Epic 2): move the five staff workspaces under a guarded `(staff)` layout (session middleware + permission check), keep `guest` public, and gate sidebar/bottom-nav **visibility** by the signed-in user's permissions. The `WORKSPACES` config in `apps/web/src/lib/workspaces.ts` is the single place to add a `requires`/`public` flag.
- **Top bar vs offline banner overlap.** The shell top bar is `sticky z-30`; the 1.6 `OfflineBanner` is `fixed top-0 z-50`, so when offline it overlaps the top of the bar. Resolve alongside the 1.4 toast-vs-fixed-bar item — offset fixed/sticky chrome by the banner height when offline.
- **Search + notifications behavior.** The top-bar search input and notifications button are static affordances in 1.7. Wire them up when the relevant epics land (search → bookings/guests/rooms; notifications → Epic 10 multi-channel notifications).

### Deferred from: code review of story 1.7

- **Drawer focus management.** The mobile drawer closes on route change, scrim tap, link click, and Escape (added in review), but it does **not** trap focus while open nor restore focus to the menu button on close, and the body is not scroll-locked when the drawer is open. Add a focus trap + focus restore + `overflow-hidden` on `<body>` when building the first real mobile-heavy workspace (Epic 7 ops), or adopt a headless dialog primitive for the drawer.
- **`not-found.tsx` for the `(app)` group.** An unmatched in-shell path (e.g. a typo'd `/front-desk/oops`) currently falls through to the framework default 404 with no shell chrome. Add an `app/(app)/not-found.tsx` rendering inside the shell once there are real nested routes.
- **Offline banner vs sticky top bar (carried).** The shell top bar is `sticky z-30`; the 1.6 `OfflineBanner` is `fixed top-0 z-50` and overlaps it when offline. Resolve together with the 1.4 toast-vs-fixed-bar item by offsetting fixed/sticky chrome by the banner height when offline.

## Deferred from: story 1.8 (shared contracts, realtime, data plumbing)

- **Live Prisma connect + first migration (no Docker/Postgres here).** The schema + generated client ship; applying a migration to a real PostgreSQL is deferred. When a DB is available (Story 1.9 CI / local Docker): run `pnpm --filter @fammycomforts/db db:migrate` to create the initial migration for `audit_logs`, and add an integration test that actually connects (health → `db: "up"`). The 1.11 ephemeral-Postgres integration harness gates this.
- **Approve pnpm build scripts for `prisma` + `@prisma/engines`.** Currently blocked (warning on install). NOT needed for `prisma generate` or the runtime (Prisma 7 driver-adapter + queryCompiler use no native query engine), but `prisma migrate` needs the **schema engine** binary — approve these (or add to an allowlist) on the CI image at Story 1.9 before running migrations.
- **Real JWT handshake auth on the Socket.IO gateway (Epic 2 / AR6).** `RealtimeGateway.handleConnection` currently only enforces token *presence* (`// TODO(Epic 2)`); wire real JWT verification + permission-scoped room joins (property + role) when auth lands.
- **Redis + BullMQ async jobs (AR3).** Not built in 1.8 (only the Socket.IO gateway is). Add the queue infra with the first job consumer (M-Pesa callbacks / notifications, Epic 5 / Epic 10).
- **Eager health-ping logging accuracy (minor).** With the lazy pg pool, `PrismaService.$connect()` resolves even with no reachable DB, so the boot log says "connected" while `/health` correctly reports `db:"down"` via the real ping. Consider an eager `SELECT 1` on init for accurate startup logging.
- **Global response interceptor (optional).** Success responses are wrapped in `{ data }` by each controller (e.g. health). If uniform wrapping is wanted later, add a response interceptor — but reconcile with controllers that already return the envelope to avoid double-wrapping.

## Deferred from: story 1.9 (CI/CD + containerized deploy)

- **Run the pipeline on GitHub.** Workflows are authored + locally validated (by inspection — no YAML parser/runner here). Push to the GitHub remote, enable **branch protection** on `main` requiring the `verify` + `e2e` checks, and confirm the first real run is green.
- **Docker image build/push (no Docker daemon here).** Dockerfiles are authored but unbuilt. Build them in CI, then flip `push: false → true` in `deploy.yml` and add registry secrets (`REGISTRY_*`). Consider Next `output: "standalone"` (web) and `turbo prune`/`pnpm deploy` (api) to slim the images.
- **`prisma migrate deploy` against a real DB + Prisma engines build script.** The migrate job needs `secrets.DATABASE_URL` and the **Prisma schema engine**, which requires approving the blocked `prisma`/`@prisma/engines` build scripts on the runner (`pnpm approve-builds` or add to `onlyBuiltDependencies`). Create the **initial `audit_logs` migration** (`db:migrate`) once a DB exists (ties to the 1.8 live-DB deferral).
- **Actual host rollout.** `deploy.yml`'s release step is a placeholder — wire the chosen target (Render/Railway/Fly.io/VPS) + host secrets.
- **Playwright browser run is CI-only.** The smoke spec + config are authored; chromium is installed and the e2e suite runs in CI (`e2e` job). Locally it needs `playwright install` + a built web server.
- **Verify native build scripts on the CI base image** (`@swc/core`, `esbuild` in `ignoredBuiltDependencies`) — carried from 1.11; confirm prebuilt binaries resolve on the runner.

## Backend pivot → Convex (2026-06-08)

Architecture/epics/data-model updated + `packages/backend/convex/` scaffolded (schema `auditLogs` + `auditLogs`/`health` functions). Outstanding:

- **Run `npx convex dev` against the dev deployment (`quixotic-boar-465`).** Requires Convex login + network (blocked in this environment — `convex codegen` errors with "No CONVEX_DEPLOYMENT set"). This produces `convex/_generated` + `.env.local`. Until then `packages/backend` has no `typecheck`/`test` wired into the gates.
- **Add backend type-check + `convex-test` unit tests** once `_generated` exists (wire a `typecheck`/`test` script into Turbo; e.g. round-trip `auditLogs.record`/`listForEntity`). Add `@edge-runtime/vm` + a vitest edge-runtime config for `convex-test`.
- **Wire the web Convex provider:** add `convex` to `apps/web`, `ConvexProvider` from `NEXT_PUBLIC_CONVEX_URL`, and migrate Convex-backed reads to `useQuery` (supersedes TanStack Query for those). Revisit the offline-mutation-queue approach (Story 1.6) against Convex's client cache/reconnect.
- **Update `deploy.yml`** to a `convex deploy` step (gated on `CONVEX_DEPLOY_KEY`) replacing the build-images→`prisma migrate`→deploy chain; drop the api Docker image + postgres/redis/minio compose services.
- **Remove `apps/api` (NestJS) + `packages/db` (Prisma)** once nothing depends on them — superseded by Convex. (Kept now as committed history; plan a cleanup story.)
- **Re-express `data-model.md` entities as Convex tables** in `convex/schema.ts`, per-story when first needed (Identity/Auth tables with Convex Auth in Epic 2).
- **Auth (Epic 2):** adopt `@convex-dev/auth`; implement the in-function `requirePermission(ctx, area, action)` RBAC helper from the unchanged permission model.

## Deferred from: story 1.10 (backup & DR baseline — Convex)

Schema (`backupRuns`), `backups.ts` (action + run mutations + prune + listRecent), `crons.ts` (daily 00:00 EAT), and the restore runbook (`packages/backend/convex/BACKUP.md`) are authored. Blocked on a Convex login / live deployment:

- **Wire `runExport()`** in `backups.ts` — replace the throwing seam with a real deployment export persisted via `ctx.storage.store(...)` (returns the `_storage` id + size). Then run a real `convex export` and confirm the artifact bytes + `sizeBytes`.
- **Cron only fires after `convex deploy`** — verify the daily job runs on schedule against `quixotic-boar-465` (dev) / `notable-cod-441` (prod).
- **Verify Convex managed-snapshot / PITR** availability + window on the current plan (dashboard); confirm it matches the RPO claim in BACKUP.md.
- **Verify retention end-to-end** — `prune` deletes blobs (`ctx.storage.delete`) beyond the 30-copy window against the live deployment.
- **Execute the non-prod restore drill** in BACKUP.md (`convex import` / restore-to-PITR → `health:check` + known-entity assertion → sign-off table). Exact steps are in the runbook.
- **Run `backups.test.ts`** — needs `convex/_generated` (`npx convex dev`/`codegen`) + the Story 1.11 `convex-test` + `edge-runtime` harness wired into `packages/backend` (deps + `test` script + edge-runtime vitest config). Authored now, inert until then.
- **Failure alerting** on a `failed` `backupRuns` row — TODO seam, later notifications epic.

## Deferred from: code review of stories 1.6 / 1.8 / 1.10 (2026-06-08, Epic 1 close)

- **[1.10] Orphan backup-run reaper.** Because scheduled actions are at-most-once (no retry), a `dailyExport` that dies between `startRun` and `completeRun` leaves a row stuck in `started` (and `failed` rows accumulate). `prune` only counts `completed`, so these are never swept. Add a reaper (mark stale `started` as `failed` after a timeout, prune old `failed`) when wiring the live export. Not an AC violation.
- **[1.6] SSR `HydrationBoundary` for prefetched queries.** The root `QueryProvider` has no dehydrate/hydrate path; server-prefetched queries would refetch on the client. Lower priority now — under the **Convex** pivot, Convex reactive `useQuery` is the primary server-state layer, so TanStack Query's role shrinks; revisit only if/when SSR-prefetched TanStack queries are actually used.
- **[1.6] Offline banner vs sticky top bar (carried from 1.7).** Still open — offset fixed/sticky chrome by the banner height when offline.
