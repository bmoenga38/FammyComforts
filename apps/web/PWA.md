# Fammy Comforts PWA — offline & background sync

Covers the offline behavior across Stories 1.5 (shell/SW) and 1.6 (indicator + data foundation).

## Offline shell

- The Serwist service worker (`src/app/sw.ts`, built to `public/sw.js`) precaches the app shell + `/offline`; `cacheOnNavigation` caches visited routes. Offline, a cached route loads from cache; an uncached navigation falls back to `/offline`.
- `OfflineBanner` (`src/components/offline-banner.tsx`) shows a top, `aria-live` banner whenever the browser reports offline (`useOnlineStatus`).
- API + cross-origin requests are **NetworkOnly** (never cached) — see `sw.ts`.

## Background sync (foundation now; activates with real mutations — Epic 2+)

`QueryProvider` (`src/components/query-provider.tsx`) configures TanStack Query with `networkMode: "offlineFirst"`. The mechanism, once feature epics add real mutations (bookings, payments, housekeeping):

1. Offline, mutations **pause** (not fail).
2. On reconnect, TanStack's `onlineManager` fires; call `queryClient.resumePausedMutations()` to replay queued mutations **in order**.
3. To survive a reload, add `@tanstack/react-query-persist-client` + a persister (localStorage/IndexedDB), persist the mutation cache, and restore + resume on load.

No queue ships today — there are no mutations to queue yet. (For endpoint-level durability, Serwist also offers a `BackgroundSyncQueue`; prefer the TanStack Query path for app mutations.)

## Lighthouse (readiness now; measurement deferred)

In place for a ≥ 90 PWA score: web manifest, registered SW, installable shell, light/dark `theme-color`, and the accessible primitives/components from Stories 1.3–1.4.

**Deferred:** run Lighthouse PWA in a real browser/HTTPS (or CI — Story 1.9) and confirm ≥ 90. The SVG-only icons may flag the installable/maskable audit; swap in a PNG 192/512 + maskable set (see `deferred-work.md`) if required.

## Build note

Web build uses `next build --webpack` so Serwist emits the SW (the legacy plugin doesn't emit under Turbopack). Dev uses Turbopack with the SW disabled. Migrate to `@serwist/turbopack` when stable (`deferred-work.md`).
