---
baseline_commit: cb5faa03fec9293f4fb5676429ca9365e8528788
---

# Story 1.5: Installable PWA app shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a guest or staff member,
I want to install the app and have its shell load,
so that SommyComfort behaves like a native app with a home-screen icon and an offline fallback.

## Acceptance Criteria

1. **Web manifest** — `app/manifest.ts` (Next metadata route) returns a valid `MetadataRoute.Manifest`: `name`/`short_name` SommyComfort, `start_url: "/"`, `display: "standalone"`, theme/background colors from the design tokens, and icons. Next auto-links it. (NFR1)
2. **Icons** — an app icon (`purpose: "any"`) and a maskable icon are provided under `public/` and referenced by the manifest. (Production PNG raster set is a follow-up — see notes.) (NFR1)
3. **Service worker via Serwist** — `@serwist/next` (`withSerwistInit` in `next.config.ts`) builds a service worker from `src/app/sw.ts` to `public/sw.js`; it precaches the app shell (`self.__SW_MANIFEST`), uses `defaultCache` runtime caching, `skipWaiting` + `clientsClaim`, and navigation preload. The SW is **disabled in development**. (NFR2)
4. **Offline fallback** — a `/offline` route exists and is served by the SW as the fallback for failed document navigations. (NFR2)
5. **Installable** — with the manifest + icons + a registered SW, the app meets the browser install criteria (verifiable in a browser; see notes). Theme color is set via `viewport`. (NFR1)
6. **Generated SW is gitignored** — `public/sw*.js` (and Serwist's worker chunks) are ignored, not committed.
7. **Green** — `pnpm build` generates `public/sw.js` and the manifest route; `pnpm typecheck`, `pnpm lint`, `pnpm test` stay green.

> Out of scope (Story 1.6): the offline **data** strategy, the online/offline **indicator banner**, **background sync**, and the **Lighthouse ≥ 90** target. This story is install + shell precache + offline fallback only.

## Tasks / Subtasks

- [x] **Task 1: Install Serwist** (AC: #3) — add `@serwist/next` + `serwist` to `apps/web` (authorized new deps).
- [x] **Task 2: Service worker source** (AC: #3, #4) — `apps/web/src/app/sw.ts`: `Serwist` with `precacheEntries: self.__SW_MANIFEST`, `defaultCache` from `@serwist/next/worker`, `skipWaiting`, `clientsClaim`, `navigationPreload`, and `fallbacks` → `/offline` for `request.destination === "document"`. Add the `__SW_MANIFEST` global typing.
- [x] **Task 3: Wire next.config** (AC: #3) — wrap the existing config with `withSerwistInit({ swSrc: "src/app/sw.ts", swDest: "public/sw.js", cacheOnNavigation: true, disable: process.env.NODE_ENV === "development" })`; preserve the existing `turbopack.root`.
- [x] **Task 4: Manifest** (AC: #1) — `apps/web/src/app/manifest.ts` returning the manifest (tokens: bg `#282a36`, theme `#282a36`); set `export const viewport` `themeColor` in `layout.tsx`.
- [x] **Task 5: Icons** (AC: #2) — `public/icon.svg` (brand house mark, `purpose any`) + `public/maskable-icon.svg` (safe-area padded, `purpose maskable`); reference both in the manifest.
- [x] **Task 6: Offline page** (AC: #4) — `apps/web/src/app/offline/page.tsx`: a simple themed page ("You're offline …") using the design tokens.
- [x] **Task 7: gitignore** (AC: #6) — ignore `public/sw.js`, `public/sw.js.map`, and `public/swe-worker-*.js` in `apps/web/.gitignore`.
- [x] **Task 8: Verify** (AC: #7) — `pnpm build` succeeds and emits `public/sw.js`; manifest route builds; `pnpm typecheck/lint/test` green. Record what was (and wasn't) verifiable without a browser.

## Dev Notes

- **Serwist is the next-pwa successor and the current Next-16 approach** (verified 2026-06-05). It works with the default **Turbopack** production build; only local *dev* PWA testing would need `--webpack`, and the SW is disabled in dev here anyway. [Source: serwist.pages.dev/docs/next/getting-started]
- **SW source pattern** (App Router + TS): import `defaultCache` from `@serwist/next/worker`; `new Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting: true, clientsClaim: true, navigationPreload: true, runtimeCaching: defaultCache, fallbacks: { entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }] } }); serwist.addEventListeners();`
- **Manifest** via `app/manifest.ts` (Next built-in metadata route) — Next auto-injects `<link rel="manifest">`. Theme color goes in `export const viewport` (Next 16 moved `themeColor` out of `metadata`).
- **Icons without raster tooling:** there is no image toolchain here, so use **SVG** icons (`type: "image/svg+xml"`, `sizes: "any"`) — sufficient for the browser install criteria. A production **PNG maskable set (192/512)** + Apple touch icons is a follow-up when real brand assets exist (note in deferred-work). Reuse the prototype's house brand mark.
- **Generated artifacts:** `public/sw.js` (+ map + `swe-worker-*.js`) are build outputs — gitignore them.
- **Verification limits:** install prompt + offline behavior + Lighthouse need an actual browser/HTTPS, which isn't available here. Verify the **build emits the SW + manifest** and stays green; defer the interactive/Lighthouse verification to a browser pass (and Story 1.6 owns Lighthouse ≥ 90).
- **No app code regressions:** keep `layout.tsx`'s no-FOUC theme script + `ToastProvider`. The SW only adds caching; the existing shell is the precache target.

### Project Structure Notes

- New: `apps/web/src/app/sw.ts`, `apps/web/src/app/manifest.ts`, `apps/web/src/app/offline/page.tsx`, `apps/web/public/{icon,maskable-icon}.svg`.
- Modified: `apps/web/next.config.ts` (withSerwistInit), `apps/web/src/app/layout.tsx` (viewport themeColor), `apps/web/.gitignore` (sw outputs), `apps/web/package.json` (deps).
- No changes to `apps/api`, `packages/*`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5] — story + ACs (NFR1, NFR2)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture] — "PWA via Serwist (@serwist/next)"
- [Source: DESIGN_SYSTEM.md] — colors for theme/background + brand mark
- [Source: https://serwist.pages.dev/docs/next/getting-started] — @serwist/next setup
- [Source: https://nextjs.org/docs/app/guides/progressive-web-apps] — App Router manifest + PWA

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- `pnpm build` 4/4 — **`public/sw.js` (43 KB) + `swe-worker-*.js` generated**; `/manifest.webmanifest` + `/offline` routes prerendered. `pnpm typecheck` 5/5 · `pnpm test` 19 · `pnpm lint` 3/3.
- Dev smoke (`next dev`): home 200, `/offline` 200, manifest serves with `name`+`standalone`, `<link rel="manifest">` present, `theme-color` meta = `#282a36`.
- **Turbopack gap (resolved):** the legacy `@serwist/next` plugin compiles under Turbopack but does **not emit the SW** (verified — no `sw.js`). Per Serwist's own warning, switched the web **build** to `next build --webpack` (which emits the SW); **dev stays Turbopack** (SW disabled in dev anyway).
- **Type fix:** `sw.ts` needs the `webworker` lib (`ServiceWorkerGlobalScope`), absent from the app's `dom` tsconfig. Excluded `src/app/sw.ts` from the app `tsc` — Serwist bundles the SW separately and erases its types, so no type resolution is needed at app-typecheck time.
- **Lint fix:** the generated `public/sw.js` was being linted (minified worker, 85 warnings + 1 error) → added it + `swe-worker-*.js` to the web eslint ignores.

### Completion Notes List

- **All 7 ACs satisfied** for the installable shell. Serwist SW (precache `__SW_MANIFEST`, `defaultCache`, skipWaiting/clientsClaim/navigationPreload, `/offline` fallback for document navigations), `app/manifest.ts` metadata route, `viewport.themeColor`, SVG app + maskable icons, `/offline` page, generated SW gitignored + eslint-ignored.
- **Build tooling note:** web `build` = `next build --webpack` (required for Serwist SW emission until `@serwist/turbopack` is stable). Trade-off: slower than Turbopack builds; dev is unaffected. Migration tracked in deferred-work.
- **Icons:** SVG (`sizes: "any"`) — sufficient for browser install criteria without a raster toolchain. Production PNG (192/512 maskable) + Apple touch icons deferred until real brand assets exist.
- **Verification limits:** the actual install prompt, offline SW serving, and **Lighthouse PWA ≥ 90** require a browser/HTTPS (not available here) — deferred to a browser pass; **Lighthouse ≥ 90 is owned by Story 1.6**. What IS verified here: the SW + manifest + offline route build and serve, and the shell still works.
- Out-of-scope respected: no offline-data strategy, no online/offline banner, no background sync, no Lighthouse work (all Story 1.6).

### File List

**New:** `apps/web/src/app/sw.ts`, `apps/web/src/app/manifest.ts`, `apps/web/src/app/offline/page.tsx`, `apps/web/public/icon.svg`, `apps/web/public/maskable-icon.svg`
**Modified:** `apps/web/next.config.ts` (withSerwistInit), `apps/web/src/app/layout.tsx` (viewport themeColor), `apps/web/package.json` (Serwist deps + `build --webpack`), `apps/web/tsconfig.json` (exclude sw.ts), `apps/web/.gitignore` (sw outputs), `apps/web/eslint.config.mjs` (ignore generated sw), `pnpm-lock.yaml`
**Modified (tracking):** `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Review fixes (2026-06-05):** `apps/web/src/app/sw.ts` (NetworkOnly api/cross-origin), `apps/web/next.config.ts` (precache `/offline`), `apps/web/src/app/manifest.ts` (id/scope), `apps/web/src/app/layout.tsx` (media themeColor), `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

| Date | Change |
|---|---|
| 2026-06-05 | Story drafted (create-story). |
| 2026-06-05 | Implemented: Serwist PWA — SW (precache + offline fallback), manifest route, SVG icons, theme color. Web build → `--webpack` (Serwist SW emission; dev stays Turbopack). build emits sw.js; typecheck/lint/test green; dev smoke green. Status → review. |
| 2026-06-05 | Code review (Edge + Acceptance). Auditor: all 7 ACs met. Fixed 2 real infra issues: `/offline` now precached (was missing from the SW manifest → offline fallback couldn't fire); `/api/` + cross-origin forced **NetworkOnly** (prevent stale/leaked auth+financial caching). Also manifest `id`/`scope` + media-query themeColor. Verified in the generated `sw.js`. Status → done. |

## Senior Developer Review (AI)

**Date:** 2026-06-05 · **Reviewer model:** claude-opus-4-8[1m] · **Layers:** Edge Case Hunter, Acceptance Auditor (Blind Hunter skipped — low value on PWA config) · **Outcome:** ✅ Approve after fixes (Auditor: all 7 ACs met; Edge Hunter caught two real generated-SW issues, both fixed)

### Action Items

- [x] [Review][Patch][High] **`/offline` was not in the SW precache manifest** (Edge Hunter inspected the generated `sw.js` — only its JS chunk, no HTML document) → the offline fallback would fail offline, undercutting AC4. Added `additionalPrecacheEntries: [{ url: "/offline", revision: null }]`; **verified `"/offline"` is now in `public/sw.js`**.
- [x] [Review][Patch][High] **`defaultCache` would NetworkFirst-cache `/api/v1/*` (24h) + cross-origin API GETs** → stale financial data + cross-session leak on shared devices once auth/payments land (Epics 2/5); also redundant with TanStack Query. → prepended a **NetworkOnly** rule for `/api/` + all cross-origin; **verified in `sw.js`**.
- [x] [Review][Patch][Med] Manifest missing `id`/`scope` (orphaned-install risk) → added `id: "/"`, `scope: "/"`.
- [x] [Review][Patch][Med] Single dark `themeColor` on a light/dark app → media-query themeColor (light `#f8fafc` / dark `#282a36`).
- [x] [Review][Defer] `skipWaiting`+`clientsClaim` auto-activate a new SW mid-session (chunk-load errors / surprise reload during a check-in) → adopt the "update available → prompt to reload" pattern (use the existing `ToastProvider`) + a ChunkLoadError boundary. (→ deferred-work)
- [x] [Review][Defer] Add a CI smoke that asserts `public/sw.js` is generated and precaches `/offline` (with Story 1.9 CI), so the dev(Turbopack, SW-off)/prod(webpack) gap can't hide a broken SW. (→ deferred-work)
- [x] [Review][Dismiss] gitignore/eslint coverage of generated SW (correct + complete, incl. `.map`); offline-page tokens resolve offline (CSS precached, page inherits the root layout/theme).

**Post-fix verification:** `pnpm build` 4/4 — `sw.js` precaches `/offline` ✓ + API NetworkOnly ✓ · `pnpm typecheck` 5/5 · `pnpm lint` 3/3 · `pnpm test` 19.
