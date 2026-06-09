---
baseline_commit: cb5faa03fec9293f4fb5676429ca9365e8528788
---

# Story 1.6: Offline data, background sync, and Lighthouse target

Status: done

> **Senior Developer Review (AI) — 2026-06-08 (Epic 1 close).** Outcome: Approved with fixes applied. Patches: **(Med)** mutations `retry: 2 → 0` in `query-provider.tsx` (non-idempotent bookings/payments must not auto-retry — double-charge/double-book risk); **(Med)** `OfflineBanner` switched from the translucent `bg-badge-warning` tint to an opaque `bg-bg-card` + `text-badge-warning-fg` (the AA-verified 1.3 pairing) + warning accent border, so contrast is deterministic over any content; **(Med coverage)** added an SSR server-snapshot test (`renderToString` → "online") — the headline SSR-safe AC was previously untested; **(Low)** added `"use client"` to `use-online-status.ts` (server-import footgun); **(Low)** `aria-label="Connection status"` on the banner so its `role="status"` doesn't collide with toasts (+ test updated). Deferred: SSR `HydrationBoundary` (reduced relevance under Convex) + banner-vs-sticky-top-bar offset (carried from 1.7) — in deferred-work. Gates green (web 37 tests).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a staff member on a poor network,
I want clear offline feedback and an offline-tolerant data foundation,
so that I can keep working with intermittent connectivity and my actions aren't lost.

> **Right-scoped (decided 2026-06-05 with Brian).** Two AC areas can't be fully realized in this environment/sequence and are explicitly deferred:
> - **Functional background sync** needs real mutations/API, which don't exist until Epic 2+. This story builds the **TanStack Query offline foundation** that makes background sync work later, and documents the activation path — it does not implement a queue with nothing to queue.
> - **Lighthouse PWA ≥ 90** needs a real browser/HTTPS (not available here). This story ensures the **readiness** (manifest, SW, installable, a11y, theme-color) and defers the **measurement** to a browser/CI pass.

## Acceptance Criteria

1. **Online/offline indicator** — a clear, accessible indicator appears when the app goes offline and disappears when it reconnects, driven by the browser's online/offline state (`navigator.onLine` + `online`/`offline` events), SSR-safe. (NFR5)
2. **Offline shell loads** — with the Story 1.5 service worker, visiting a cached route offline loads from cache, and an uncached navigation falls back to `/offline`. (Verified at the SW/precache level; documented.) (NFR2/NFR5)
3. **TanStack Query offline foundation** — `@tanstack/react-query` is installed and a `QueryProvider` wraps the app with offline-tolerant defaults (`networkMode: "offlineFirst"`, sensible retry). This is the foundation the offline mutation queue / background sync builds on. (NFR3 — foundation)
4. **Background-sync path documented + deferred** — the mutation-queue + replay-on-reconnect approach is documented (TanStack Query `networkMode` paused mutations + `resumePausedMutations()` on reconnect, optionally `persistQueryClient`), and explicitly **activates when real mutations land (Epic 2+)**. No functional queue is shipped now (nothing to queue). (NFR3 — deferred)
5. **Lighthouse readiness + deferred measurement** — the PWA prerequisites are in place (manifest, registered SW, installable shell, theme-color, a11y from 1.3/1.4); the actual **Lighthouse ≥ 90 measurement is deferred to a browser/CI pass** and recorded as a follow-up. (NFR1 — deferred measurement)
6. **Accessibility + green** — the offline indicator is announced (`role`/`aria-live`), AA-contrast (reuse tokens); a test covers the online-status hook and the banner; `pnpm build/typecheck/lint/test` stay green.

> Out of scope: the role-workspace shell (1.7), the Prisma data layer + real queries/mutations (1.8), CI (1.9). This story is the offline UX indicator + the client-side offline data foundation only.

## Tasks / Subtasks

- [x] **Task 1: Online-status hook** (AC: #1, #6) — `apps/web/src/lib/use-online-status.ts`: `useSyncExternalStore` over `online`/`offline` window events; `getSnapshot = navigator.onLine`; `getServerSnapshot = true` (SSR-safe).
- [x] **Task 2: OfflineBanner** (AC: #1, #6) — `apps/web/src/components/offline-banner.tsx` (`"use client"`): renders a fixed, `aria-live` banner using status tokens only when offline; nothing when online.
- [x] **Task 3: TanStack Query foundation** (AC: #3) — add `@tanstack/react-query`; `apps/web/src/components/query-provider.tsx` (`"use client"`) with a per-app `QueryClient` (`networkMode: "offlineFirst"`, `retry: 2`, `refetchOnWindowFocus: false`).
- [x] **Task 4: Wire layout** (AC: #1, #3) — wrap `{children}` with `QueryProvider` (outermost) and render `<OfflineBanner />`; keep the no-FOUC script + `ToastProvider`.
- [x] **Task 5: Docs** (AC: #4, #5) — a `PWA.md` (or section) documenting: offline shell behavior (1.5 SW), the background-sync activation path (paused mutations + `resumePausedMutations` on reconnect + optional `persistQueryClient`), and the Lighthouse readiness checklist + deferred measurement.
- [x] **Task 6: Tests + verify** (AC: #6) — Vitest+RTL: `useOnlineStatus` (toggling `navigator.onLine` + dispatching events) and `OfflineBanner` (shows offline / hidden online); `pnpm build/typecheck/lint/test` green.

## Dev Notes

- **Builds on Story 1.5** (SW + manifest + `/offline`). Don't re-touch the SW; this story adds the client-side offline UX + data foundation.
- **`useOnlineStatus` must be SSR-safe** — use `useSyncExternalStore` with `getServerSnapshot = () => true` (assume online on the server); the client snapshot reads `navigator.onLine`. Same hydration-safe pattern as `ThemeToggle` (Story 1.2). [Source: apps/web/src/components/theme-toggle.tsx]
- **OfflineBanner a11y** — `role="status"` + `aria-live="polite"`, AA-contrast status tokens (e.g. `bg-badge-warning text-badge-warning-fg` from 1.3), fixed at top, large-enough tap/readable. Status not by color alone (include text). [Source: EXPERIENCE.md Accessibility Floor]
- **TanStack Query `networkMode: "offlineFirst"`** — queries/mutations attempt once then pause when offline; on reconnect, `onlineManager` resumes. Mutations made offline are **paused** (not failed); `queryClient.resumePausedMutations()` replays them on reconnect — this is the background-sync mechanism, but it needs real mutations to exercise (Epic 2+). Optionally add `@tanstack/react-query-persist-client` + a persister later so paused mutations survive reloads. [Source: architecture.md#Frontend-Architecture — TanStack Query for server state + offline mutation queue]
- **Lighthouse** — can't run here (no browser). The shell already has: manifest (1.5), registered SW (1.5), installable criteria (SVG-icon caveat noted in 1.5 deferred-work), theme-color, and the a11y from 1.3/1.4. Defer the actual ≥ 90 measurement to a browser/CI run; note the SVG→PNG icon item may affect the PWA-installable audit. [Source: deferred-work.md story 1.5]
- **No regressions** — preserve `layout.tsx`'s theme script, `ToastProvider`, fonts.

### Project Structure Notes

- New: `apps/web/src/lib/use-online-status.ts`, `apps/web/src/components/{offline-banner,query-provider}.tsx`, `apps/web/src/lib/use-online-status.test.tsx` (or `.ts`), `apps/web/src/components/offline-banner.test.tsx`, `apps/web/PWA.md`.
- Modified: `apps/web/src/app/layout.tsx`, `apps/web/package.json` (@tanstack/react-query).
- No changes to `apps/api`, `packages/*`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6] — story + ACs (NFR1, NFR2, NFR3, NFR5)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture] — TanStack Query offline mutation queue, Serwist PWA
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Fammy Comforts-2026-06-05/EXPERIENCE.md] — offline a first-class state, clear indicators, accessibility floor
- [Source: apps/web/src/app/sw.ts] — the Story 1.5 SW this builds on
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — 1.5 deferrals (Lighthouse measurement, PNG icons, SW update strategy)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- `pnpm test` → **8 web test files / 22 web tests** (added `useOnlineStatus` 1, `OfflineBanner` 2); 4 tasks green (shared 5, api 1, web 22).
- `pnpm build` 4/4 (SW still emitted) · `pnpm typecheck` 5/5 · `pnpm lint` 3/3.

### Completion Notes List

- **All 6 (right-scoped) ACs satisfied.** Delivered the real, buildable parts; the two environment/sequence-blocked areas were scoped to "document + defer" and are honestly closed as such.
- **Online/offline indicator (AC1):** `useOnlineStatus` (`useSyncExternalStore`, SSR-safe `getServerSnapshot = true`) + `OfflineBanner` (`role="status"` `aria-live`, AA `bg-badge-warning`/`text-badge-warning-fg`, text + dot). Tested for both states.
- **Offline shell (AC2):** verified at the SW level (Story 1.5 precaches the shell + `/offline`; `cacheOnNavigation` caches visited routes; API/cross-origin NetworkOnly). Documented in `PWA.md`.
- **TanStack Query foundation (AC3):** `QueryProvider` with `networkMode: "offlineFirst"` (queries + mutations), retry 2, no refetch-on-focus — wraps the app (outermost, above ToastProvider). This is the substrate the offline mutation queue uses.
- **Background sync (AC4) — documented + deferred:** `PWA.md` describes the paused-mutations → `resumePausedMutations()` on reconnect → optional `persistQueryClient` path; **activates when real mutations land (Epic 2+)**. No queue shipped (nothing to queue).
- **Lighthouse (AC5) — readiness now, measurement deferred:** manifest + SW + installable + theme-color + a11y are in place; the ≥ 90 **measurement needs a browser/HTTPS** (not available here) → deferred to a browser/CI pass (Story 1.9). SVG-icon caveat may affect the installable audit (tracked).
- **No regressions:** layout still has the no-FOUC theme script + ToastProvider; SW unchanged.

### File List

**New:** `apps/web/src/lib/use-online-status.ts` + `use-online-status.test.tsx`; `apps/web/src/components/{offline-banner,query-provider}.tsx`; `apps/web/src/components/offline-banner.test.tsx`; `apps/web/PWA.md`
**Modified:** `apps/web/src/app/layout.tsx` (QueryProvider + OfflineBanner), `apps/web/package.json` (@tanstack/react-query), `pnpm-lock.yaml`
**Modified (tracking):** `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
|---|---|
| 2026-06-05 | Story drafted (create-story), right-scoped: offline indicator + TanStack Query foundation now; functional background-sync + Lighthouse measurement deferred. |
| 2026-06-05 | Implemented (right-scoped): online/offline indicator (`useOnlineStatus` + `OfflineBanner`), TanStack Query offline foundation (`QueryProvider`), `PWA.md` (bg-sync path + Lighthouse readiness). 22 web tests; build/typecheck/lint green. Background-sync + Lighthouse measurement documented+deferred. Status → review. |
