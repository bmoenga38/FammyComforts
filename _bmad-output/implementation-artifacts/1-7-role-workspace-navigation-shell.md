---
baseline_commit: cb5faa03fec9293f4fb5676429ca9365e8528788
---

# Story 1.7: Role-workspace navigation shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the six role workspaces navigable within the app shell,
so that I can reach guest, admin, front desk, operations, housekeeping, and kitchen areas.

> **Scope (navigation shell only).** This story builds the **app shell** (sidebar + top bar + mobile bottom nav) and **six navigable route segments** that each render their workspace title + an empty placeholder — matching the `prototype/`'s six views. It does **not** build the workspace feature content (that lands in Epics 2–9) and it does **not** add auth/RBAC guarding (Epic 2). The `(guest)` public vs `(staff)` guarded route-group split from `architecture.md` is **deferred to Epic 2** — see Dev Notes; the shell is built so that split is a clean follow-up.

## Acceptance Criteria

1. **App shell renders** — a persistent shell with a left **sidebar** (brand + six workspace nav items + theme toggle + an offline/PWA status pill) and a **top bar** (page title + search affordance + notifications affordance) wraps every workspace route, matching the `prototype/` layout. (UX-DR6, UX-DR-NOTE)
2. **Six workspaces are navigable** — selecting a workspace navigates to its route and renders the corresponding segment with its title: **Guest Booking** (`/guest`), **Admin** (`/admin`), **Front Desk** (`/front-desk`), **Operations** (`/operations`), **Housekeeping** (`/housekeeping`), **Kitchen** (`/kitchen`). Each page renders its workspace `<h1>` title and an empty-state placeholder (no feature content yet). (UX-DR6, UX-DR7, UX-DR10)
3. **Top-bar title tracks the active workspace** — the top bar shows the active workspace's title (e.g. "Guest Booking", "Front Desk Calendar"), derived from the current route, matching the prototype's `titleByView` mapping. The browser tab `<title>` is also set per workspace.
4. **Active nav state** — the nav item (sidebar **and** mobile bottom nav) for the current route shows an active visual state and `aria-current="page"`, driven by the actual pathname (not click-only state, so deep links highlight correctly).
5. **Responsive + mobile bottom nav** — on mobile the sidebar collapses behind a menu button (drawer + scrim, closes on selection/scrim tap) and a fixed **bottom nav** exposes the primary workspaces (matching the prototype's 5-item bottom nav); on desktop the sidebar is persistent and the bottom nav is hidden. (UX-DR6)
6. **Root route** — visiting `/` lands the user on the default workspace (`/guest`) without a dead/blank root. The existing component showcase is preserved at a non-default path (e.g. `/_showcase` route or kept as a dev-only page) — it must not be the production root.
7. **Accessibility + green** — `<nav>` landmarks are labeled, the active item exposes `aria-current="page"`, nav/menu controls are keyboard-operable with visible focus, tap targets on nav items meet the ≥44px mobile floor, and theme toggle still works from the sidebar. `pnpm build/typecheck/lint/test` stay green, including a test that asserts the six workspaces are present and the active state tracks the pathname.

> Out of scope: workspace feature content (Epics 2–9), auth/login + route guarding + permission-gated nav visibility (Epic 2), real search + notifications behavior (later epics — render the affordances only), data/Prisma (1.8). This story is the navigable shell + six titled placeholder routes only.

## Tasks / Subtasks

- [x] **Task 1: Workspace config** (AC: #2, #3, #4) — add `apps/web/src/lib/workspaces.ts` exporting a single source-of-truth `WORKSPACES` array: `{ slug, navLabel, title, icon (lucide), inBottomNav: boolean }` for the six workspaces (guest, admin, front-desk, operations, housekeeping, kitchen). Titles match the prototype `titleByView` (Guest Booking, Admin Dashboard, Front Desk Calendar, Operations Manager, Housekeeping Tasks, Kitchen Display). Bottom-nav set = guest, admin, front-desk, housekeeping, kitchen (per prototype's 5 items).
- [x] **Task 2: AppShell layout component** (AC: #1, #5) — build the shell as composable pieces:
  - [x] `apps/web/src/components/shell/sidebar.tsx` (`"use client"`) — brand, nav list from `WORKSPACES`, sidebar footer with the existing `<ThemeToggle />` + an offline/PWA pill (reuse `useOnlineStatus` for the dot/label).
  - [x] `apps/web/src/components/shell/top-bar.tsx` (`"use client"`) — mobile menu button, page title (derived from pathname via `WORKSPACES`), search + notifications affordances (static, non-functional, labeled).
  - [x] `apps/web/src/components/shell/bottom-nav.tsx` (`"use client"`) — fixed bottom nav from the bottom-nav workspace subset; hidden ≥ desktop breakpoint.
  - [x] `apps/web/src/components/shell/app-shell.tsx` (`"use client"`) — composes sidebar + top-bar + `{children}` + bottom-nav; owns the mobile drawer open/close state + scrim; closes drawer on route change.
- [x] **Task 3: Active-state nav** (AC: #4) — a shared `NavItem` (or inline) using `usePathname()` from `next/navigation`; active when pathname starts with the workspace slug; sets `aria-current="page"` + active classes. Sidebar and bottom nav share this logic.
- [x] **Task 4: Route group + six segments** (AC: #2, #3, #6) — create a shared route group with the shell `layout.tsx` and six `page.tsx` segments, each rendering its `<h1>` title + an `EmptyState` placeholder, and exporting `metadata.title` per workspace. Make `/` redirect to `/guest`.
- [x] **Task 5: Relocate the showcase** (AC: #6) — move the current root showcase (`apps/web/src/app/page.tsx` + `_showcase-interactive.tsx`) to a non-default route (e.g. `apps/web/src/app/_showcase/page.tsx`) so `/` is the workspace shell; keep the showcase reachable for component QA.
- [x] **Task 6: Tests + verify** (AC: #4, #7) — Vitest+RTL with `next/navigation` mocked (`usePathname`): assert all six workspaces render in the sidebar, that the active item for a given pathname has `aria-current="page"`, and that the top bar shows the matching title. Run `pnpm build/typecheck/lint/test` — all green.

## Dev Notes

### Binding visual reference: the prototype
- **`prototype/` is the binding layout reference** (UX-DR-NOTE: no standalone UX spec; the prototype is binding for screen layout, `DESIGN_SYSTEM.md` for tokens/components). Port the shell's structure and class intent into React + Tailwind v4 tokens — **do not** copy `prototype/styles.css` verbatim; use the existing token utilities (`bg-bg-card`, `text-text`, `text-text-dim`, status tokens) established in Stories 1.2–1.4.
- **Shell anatomy (from `prototype/index.html`):**
  - `aside.sidebar[aria-label="Main navigation"]` → brand (`SommyComfort` / "Accommodation PWA"), `nav.nav-list` of six `button.nav-item[data-view]`, `.sidebar-footer` with an `.online-pill` ("PWA ready") + the theme toggle.
  - `header.topbar` → `button.mobile-menu[aria-label="Open menu"]`, `.topbar-title` (eyebrow "Rental operations suite" + `h1#pageTitle`), `.top-actions` (search input + notifications icon-button with a dot).
  - `nav.bottom-nav[aria-label="Quick navigation"]` → five `button.bottom-item[data-view]` (Book/Admin/Desk/Clean/Kitchen).
  - Behavior in `prototype/app.js`: `titleByView` map, `switchView()` toggles `.active` across `.nav-item`+`.bottom-item` by `data-view` and sets the page title; `mobileMenu` toggles `body.menu-open`; `scrim` closes it. **Port these to App Router routing + `usePathname()`** (route-driven, not class-toggle).
- **Six workspaces + titles (exact):** guest→"Guest Booking", admin→"Admin Dashboard", frontdesk→"Front Desk Calendar", operations→"Operations Manager", housekeeping→"Housekeeping Tasks", kitchen→"Kitchen Display". Use kebab `front-desk` for the route slug (not `frontdesk`).
- **Icons (lucide-react, already a dep):** guest→`BedDouble`, admin→`LayoutDashboard`, front-desk→`CalendarDays`, operations→`Wrench`, housekeeping→`Brush`, kitchen→`ChefHat` (the prototype uses inline SVGs for bed/dashboard/calendar/wrench/brush/chef — map to the nearest lucide equivalents, consistent with the icon approach in Stories 1.3/1.4).

### Architecture compliance
- **Routing pattern (`architecture.md#Frontend-Architecture`):** "App-Router segments per role workspace (`(guest)`, `(staff)`), with route groups guarded by session + permission." Auth + RBAC do **not** exist yet (Epic 2). **Decision for this story:** build one shared shell route group hosting all six segments now; **defer** the `(guest)` public vs `(staff)`-guarded split to Epic 2, when the auth middleware + permission checks land. Record this as a deferred item. This keeps the shell honest (navigable today) and the guard-split a localized follow-up (move the five staff segments under a guarded `(staff)` layout + gate nav visibility by permission).
- **Local UI state = Zustand, no Redux** (`architecture.md`). The drawer open/close is trivial component state — **do not** add Zustand for it yet; keep it in the `AppShell` client component. (Zustand arrives when shared cross-component UI state actually appears.)
- **Code naming (`architecture.md#Code-Naming`):** React components `PascalCase` files for components; non-component TS `kebab-case` (`workspaces.ts`). The existing repo convention (Stories 1.2–1.4) uses kebab-case component **filenames** (`offline-banner.tsx`, `theme-toggle.tsx`, `query-provider.tsx`) with `PascalCase` exports — **follow the repo's existing kebab-case filename convention** for consistency, not the architecture's literal "PascalCase files" note.

### ⚠️ Next.js 16.2 — read the local docs first
- **`apps/web/AGENTS.md` warning is binding:** "This is NOT the Next.js you know… Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." Before using App Router APIs, **read the local docs** for: route groups + `layout.tsx`, `redirect()` and `usePathname()` from `next/navigation`, per-route `metadata`, and `"use client"` boundaries. Verify the exact import paths/signatures against the installed version — do not assume from training data.
- `usePathname()` requires a **client component**; the shell pieces that read it (`Sidebar`, `BottomNav`, `TopBar`) must be `"use client"`. The route-group `layout.tsx` itself can stay a server component that renders the client `<AppShell>`.
- `/` → default workspace: prefer `redirect("/guest")` from a server `app/page.tsx` (or a route-group default). Confirm `redirect` import + behavior in the local docs.

### Build on existing work — do not regress
- **`layout.tsx` (root) must keep:** the no-FOUC theme script, fonts (Inter/Space Grotesk/Syne/JetBrains Mono), `viewport.themeColor`, and the `QueryProvider > ToastProvider > OfflineBanner` wrapping (Stories 1.2/1.5/1.6). The shell goes **inside** that — the root layout stays the outer wrapper; the new shell route-group `layout.tsx` renders `<AppShell>` around `{children}`. [Source: apps/web/src/app/layout.tsx]
- **Reuse, don't rebuild:** `<ThemeToggle />` (1.2), `useOnlineStatus` (1.6) for the sidebar pill, `EmptyState` + `Button` (1.3/1.4) for placeholder pages. Import from `@/components/ui` and existing modules.
- **`OfflineBanner`** is already fixed at the top from the root layout — ensure the shell's top bar / sticky positioning doesn't visually collide with it (offset or stack); note the toast-vs-fixed-bar overlap caveat from 1.4 deferred-work and keep the bottom nav clear of the toast region (`env(safe-area-inset-bottom)`).

### Accessibility (UX-DR9, EXPERIENCE.md floor)
- `<nav aria-label="…">` on both sidebar and bottom nav (distinct labels). Active item: `aria-current="page"`. Mobile menu button: `aria-label`, `aria-expanded`, controls the drawer. Visible focus rings (existing `--border-focus`). **≥44px tap targets** on nav items + menu button (the 44px floor was flagged in 1.4 deferred-work — meet it here for nav). Status/active not by color alone (active item also gets weight/indicator). Theme toggle remains operable.

### Testing standards
- Vitest + RTL + jsdom (web), per `TESTING.md` / Story 1.11 harness. Mock `next/navigation`: `vi.mock("next/navigation", () => ({ usePathname: () => "/front-desk", redirect: vi.fn() }))`. Assert: all six nav labels present; the item matching the mocked pathname has `aria-current="page"`; the top bar renders the matching title. Keep tests colocated (`*.test.tsx`) like existing component tests.

### Project Structure Notes

- **New:** `apps/web/src/lib/workspaces.ts`; `apps/web/src/components/shell/{app-shell,sidebar,top-bar,bottom-nav}.tsx` (+ a colocated `*.test.tsx`); the shell route-group `layout.tsx` + six `page.tsx` segments (`guest/`, `admin/`, `front-desk/`, `operations/`, `housekeeping/`, `kitchen/`); `apps/web/src/app/page.tsx` → redirect to `/guest`; relocated `_showcase/`.
- **Modified:** root `layout.tsx` only if needed (should stay intact — shell wraps via the route-group layout). `apps/web/src/app/page.tsx` (now a redirect).
- **Route-group choice:** use a single shared group for the shell (e.g. `app/(app)/…`). Document the future `(guest)`/`(staff)` split (Epic 2) inline. No changes to `apps/api`, `packages/*`.
- **Variance noted:** architecture's `(guest)`/`(staff)` two-group split is intentionally deferred (no auth yet) — see Architecture compliance above; tracked in deferred-work.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7] — story + AC (UX-DR6, UX-DR7, UX-DR10); UX-DR definitions (lines 136–146); UX-DR-NOTE (prototype is binding visual reference).
- [Source: prototype/index.html] — app shell markup: `aside.sidebar`, `header.topbar`, `nav.bottom-nav` (the binding layout).
- [Source: prototype/app.js] — `titleByView` map, `switchView()`, mobile menu/scrim behavior to port to routing.
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture] — App-Router `(guest)`/`(staff)` route groups, Zustand for local UI state, TanStack Query.
- [Source: apps/web/AGENTS.md] — Next.js 16.2 breaking-changes warning; read `node_modules/next/dist/docs/` before coding.
- [Source: apps/web/src/app/layout.tsx] — root layout to preserve (theme script, fonts, providers, OfflineBanner).
- [Source: apps/web/src/components/theme-toggle.tsx, apps/web/src/lib/use-online-status.ts] — reuse in the sidebar footer.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — 44px tap-target floor (1.4), toast-vs-fixed-bar overlap (1.4).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- Read the **local** Next.js 16.2.7 docs first (per `apps/web/AGENTS.md`): `route-groups.md`, `use-pathname.md`, `redirect.md` — confirmed route groups add no URL segment, `usePathname` needs a client component, `redirect()` works in a server page.
- `pnpm test` → **4 tasks green; web 11 files / 31 tests** (added `workspaces` 5, `Sidebar` 2, `TopBar` 2 = +9 over 1.6's 22). `pnpm typecheck` 5/5 · `pnpm lint` 3/3 · `pnpm build --webpack` 4/4 (SW emitted; `/offline` still precached — verified in `public/sw.js`).
- Build route table confirms all six workspaces + root + showcase prerendered: `/`, `/guest`, `/admin`, `/front-desk`, `/operations`, `/housekeeping`, `/kitchen`, `/showcase`.
- Lint caught React 19 `react-hooks/set-state-in-effect` on the drawer-close effect → replaced with React's render-phase "adjust state when a value changes" pattern (store `lastPathname`, compare during render).

### Completion Notes List

- **All 7 ACs satisfied.** Navigable app shell + six titled placeholder routes; no feature content, no auth (both correctly out of scope).
- **AC1 (shell):** `AppShell` composes `Sidebar` (brand + six nav items + offline/PWA pill via `useOnlineStatus` + reused `ThemeToggle`) + `TopBar` + `BottomNav`, ported from `prototype/index.html` into Tailwind v4 token utilities (no verbatim CSS copy).
- **AC2 (six workspaces):** route group `app/(app)/` (no URL segment) with `layout.tsx` → `<AppShell>` and six `page.tsx` segments (`/guest /admin /front-desk /operations /housekeeping /kitchen`), each an `EmptyState` placeholder + per-route `metadata.title`.
- **AC3 (title tracks route):** the top-bar `<h1>` is derived from the pathname via `workspaceForPathname` (matching the prototype's `titleByView`); per-page `metadata.title` sets the browser tab title. **AC2/AC3 reconciliation:** the route-derived top-bar `<h1>` IS each page's title heading — one `<h1>` per page (a11y-correct), rather than duplicating an `<h1>` inside each placeholder.
- **AC4 (active state):** `usePathname()` + `isWorkspaceActive` (exact or nested match, no prefix-bleed) drive active classes + `aria-current="page"` in both sidebar and bottom nav — deep links highlight correctly. Unit + RTL tests cover this.
- **AC5 (responsive):** desktop = persistent `lg:` sidebar (`lg:pl-64`), bottom nav hidden; mobile = off-canvas drawer (translate-x) + scrim + fixed 5-item bottom nav; drawer closes on selection (`onNavigate`), scrim tap, and route change.
- **AC6 (root):** `app/page.tsx` → `redirect("/guest")`. Showcase relocated to **`/showcase`** (not `/_showcase` — `_`-prefixed folders are Next.js *private folders* and would not route; the story's "e.g." path was adjusted accordingly). `git mv` preserved history for `page.tsx`.
- **AC7 (a11y + green):** labeled `<nav>` landmarks ("Workspaces", "Quick navigation"), `aria-current="page"`, `aria-expanded` on the menu button, visible focus rings, **≥44px** tap targets (`min-h-11` sidebar / `min-h-14` bottom nav / `size-11` icon buttons), theme toggle still works. All four gates green.
- **Deferred (documented):** the architecture's `(guest)` public vs `(staff)` guarded route-group split is deferred to Epic 2 (no auth yet) — added to `deferred-work.md`. Search + notifications are static affordances (behavior in later epics). The top bar is `sticky z-30`; the offline banner (`fixed z-50`) sits above it when offline — minor edge-state overlap, already on the 1.4 deferred list.
- **No regressions:** root `layout.tsx` (theme script, fonts, `QueryProvider > ToastProvider > OfflineBanner`) untouched; SW unchanged and still precaches `/offline`.

### File List

**New:**
- `apps/web/src/lib/workspaces.ts` + `workspaces.test.ts`
- `apps/web/src/components/shell/{app-shell,sidebar,top-bar,bottom-nav,workspace-placeholder}.tsx`
- `apps/web/src/components/shell/{sidebar,top-bar}.test.tsx`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/(app)/{guest,admin,front-desk,operations,housekeeping,kitchen}/page.tsx`

**Modified:**
- `apps/web/src/app/page.tsx` (now redirects `/` → `/guest`)

**Relocated:**
- `apps/web/src/app/page.tsx` → `apps/web/src/app/showcase/page.tsx` (component showcase; `git mv`)
- `apps/web/src/app/_showcase-interactive.tsx` → `apps/web/src/app/showcase/_showcase-interactive.tsx`

**Modified (tracking/docs):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

| Date | Change |
|---|---|
| 2026-06-08 | Story drafted (create-story): app shell + six navigable titled route segments; `(guest)`/`(staff)` guard-split deferred to Epic 2. |
| 2026-06-08 | Implemented: `WORKSPACES` config, shell (`AppShell`/`Sidebar`/`TopBar`/`BottomNav`) ported from prototype, route group `(app)` + six placeholder pages, `/`→`/guest` redirect, showcase relocated to `/showcase`. 9 new tests (web 31 total); build/typecheck/lint green; SW `/offline` precache verified. Status → review. |
| 2026-06-08 | Code review (3 adversarial layers) + fixes: solid `-fg` status/notification dots, off-canvas sidebar `invisible lg:visible` (a11y), skip link, Escape-to-close drawer, tab-title template, `ShowcasePage` rename, +5 tests (bottom-nav, app-shell → web 36). 3 items deferred. Status → done. |

## Senior Developer Review (AI)

**Date:** 2026-06-08 · **Reviewer:** Claude Opus 4.8 (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor) · **Outcome:** Approved with fixes applied.

Scope: the 1.7 diff only (shell + workspaces config + route group + six pages + root redirect + relocated showcase). All four gates green after fixes: web **13 test files / 36 tests**, typecheck 5/5, lint 3/3, build 4/4 (SW `/offline` precache intact).

### Review Findings

**Patches (applied):**

- [x] [Review][Patch] Status/notification dots used transparent tint tokens → near-invisible (`bg-badge-*` is a 14% `color-mix`); switched to solid `bg-badge-*-fg` [apps/web/src/components/shell/sidebar.tsx, top-bar.tsx]
- [x] [Review][Patch] Off-canvas mobile sidebar kept its links in the tab order / a11y tree when closed → added `invisible lg:visible` so it's inert on mobile-closed, active on desktop [apps/web/src/components/shell/app-shell.tsx]
- [x] [Review][Patch] Bottom-nav active state was untested though AC4 requires both navs → added bottom-nav.test.tsx (renders 5 items, asserts `aria-current`) [apps/web/src/components/shell/bottom-nav.test.tsx]
- [x] [Review][Patch] AppShell drawer state (open/scrim-close/Escape) was untested → added app-shell.test.tsx [apps/web/src/components/shell/app-shell.test.tsx]
- [x] [Review][Patch] No skip-to-content link despite persistent nav before `<main>` (WCAG 2.4.1) → added skip link + `<main id="main-content" tabIndex={-1}>` [apps/web/src/components/shell/app-shell.tsx]
- [x] [Review][Patch] Mobile drawer had no Escape-to-close → added a `keydown` listener (closes on Escape) [apps/web/src/components/shell/app-shell.tsx]
- [x] [Review][Patch] Per-page `metadata.title` overrode site branding → added `title.template` "%s · SommyComfort" in the root layout [apps/web/src/app/layout.tsx]
- [x] [Review][Patch] Leftover `Home` export name on the relocated showcase → renamed `ShowcasePage` [apps/web/src/app/showcase/page.tsx]
- [x] [Review][Patch] Bottom-nav focus ring used a negative offset inconsistently → kept the inset (correct at the screen's bottom edge) and documented why [apps/web/src/components/shell/bottom-nav.tsx]

**Deferred (out of scope now, tracked in deferred-work.md):**

- [x] [Review][Defer] Drawer focus-trap + focus-restore-to-trigger + body-scroll-lock when open — adopt when the first mobile-heavy workspace lands (Epic 7).
- [x] [Review][Defer] `app/(app)/not-found.tsx` so unmatched in-shell paths render with shell chrome — add with the first nested routes.
- [x] [Review][Defer] Offline banner (`fixed z-50`) overlaps the sticky top bar (`sticky z-30`) when offline — resolve with the 1.4 toast-vs-fixed-bar item.

**Dismissed (≈7):** "root `/` 404" (×3 — diff artifact: the new untracked redirect `page.tsx` was omitted from the review diff but exists on disk and builds; real takeaway = commit it); showcase "content rewritten" (false — pre-existing uncommitted 1.4 edits, nothing lost); AC2 literal per-page `<h1>` (intentional, documented reconciliation to a single route-derived top-bar `<h1>`); `WORKSPACE_BY_SLUG` cast totality (currently sound); StatusChip icon drop / duplicate-`main` risk / `/showcase` dead-end (cosmetic / acceptable for a dev QA page).
