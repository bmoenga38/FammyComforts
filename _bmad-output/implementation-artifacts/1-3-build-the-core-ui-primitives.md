# Story 1.3: Build the core UI primitives

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the foundational UI primitives implemented once,
so that every feature reuses consistent, accessible base controls instead of re-styling ad hoc.

## Acceptance Criteria

1. **Primitives exist and are importable** — `Button`, `Input`, `Card`, `Table` (dense, sticky header), and `StatusChip` live under `apps/web/src/components/ui/` and are exported from a barrel (`apps/web/src/components/ui/index.ts`); each renders using the Story 1.2 design tokens (8px radius via `rounded-lg`, `border-border`, `bg-bg-card`, `text-text`, etc.). (UX-DR5)
2. **Button** — supports `variant` (`primary` | `ghost`), `size` (`default` | `sm`), and a `fullWidth` option; renders a real `<button>` that forwards ref and props; supports an optional leading **lucide-react** icon; has a visible `focus-visible` ring using `--border-focus`. (UX-DR4, UX-DR5)
3. **Input** — token-styled text input with an 8px radius and a **visible focus border** (`--border-focus`); forwards ref/props; pairs with a `<label>` (associable via `id`/`htmlFor`); disabled state styled. (UX-DR5, UX-DR9)
4. **Card** — container with `bg-bg-card`, a 1px `border-border`, 8px radius; optional padding; composes (`Card`, and at least a content area) cleanly. (UX-DR5)
5. **Table** — dense, readable table primitives (`Table` wrapper + `thead`/`tbody`/`th`/`td` styling) with a **sticky header** (`position: sticky` thead), correct `th` `scope`, and legibility in both themes. (UX-DR5)
6. **StatusChip** — accepts `status` ∈ {success, info, warning, danger, premium}, renders the per-theme **status color** text on a per-theme tinted **badge background** (resolves the Story 1.2 deferral — backgrounds track the status color per theme, not dark-only literals), supports an optional lucide icon, and meets contrast in both themes. (UX-DR3)
7. **lucide-react integrated** — `lucide-react` is installed and used by at least `Button` (icon slot) and the showcase, with decorative icons marked `aria-hidden`. (UX-DR4)
8. **Accessibility** — every interactive primitive has a visible focus indicator and correct semantics (real `<button>`, labelled inputs, `th[scope]`); decorative icons are `aria-hidden`; foreground/background pairs meet WCAG AA (4.5:1 text / 3:1 large) in **both** themes. (UX-DR9, NFR11)
9. **Showcase + green** — `apps/web/src/app/page.tsx` is updated to a primitives showcase (all five primitives, both themes via the existing toggle); `pnpm build`, `pnpm typecheck`, `pnpm lint` stay green.

> Out of scope (later stories): the *composite* domain components (MetricTile, TaskCard, Kanban column, CalendarSlot, Toast, SegmentedControl, EmptyState) → **Story 1.4**; PWA → 1.5/1.6; role-workspace shell → 1.7; unit/RTL tests for components → the test harness (Story 1.9 / `tea` module). Build only the five primitives above.

## Tasks / Subtasks

- [ ] **Task 1: Add dependencies + the `cn` helper** (AC: #1, #7)
  - [ ] Install into `apps/web`: `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` (latest as of 2026-06; see Dev Notes for the lucide peer-dep note). Authorized new deps — do not add others without asking.
  - [ ] Create `apps/web/src/lib/cn.ts` exporting `cn(...inputs)` = `twMerge(clsx(inputs))`
- [ ] **Task 2: Button** (AC: #2, #7, #8)
  - [ ] `apps/web/src/components/ui/button.tsx` using `cva` for variant/size; `variant: primary|ghost`, `size: default|sm`, `fullWidth?: boolean`
  - [ ] Primary = `bg-primary text-bg-deep`; ghost = `bg-transparent border border-border text-text hover:bg-bg-input`; 8px radius; `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus`; forwards ref; spreads `...props`; `disabled` styled (reduced opacity, no pointer)
  - [ ] Accepts children (icon + label); icons passed by the caller are lucide-react components
- [ ] **Task 3: Input** (AC: #3, #8)
  - [ ] `apps/web/src/components/ui/input.tsx` — `bg-bg-input` (or `bg-bg-alt`) text input, `border border-border`, `rounded-lg`, `focus-visible`/focus `border-border-focus`/ring; forwards ref; disabled styled; `text-text` + `placeholder:text-text-dim`
- [ ] **Task 4: Card** (AC: #4)
  - [ ] `apps/web/src/components/ui/card.tsx` — `Card` (`bg-bg-card border border-border rounded-lg`) and a `CardContent` (padding) sub-part; accept `className` merged via `cn`
- [ ] **Task 5: Table** (AC: #5, #8)
  - [ ] `apps/web/src/components/ui/table.tsx` — a `Table` wrapper (`overflow-auto rounded-lg border border-border`) + styled `table`/`thead`/`th`/`td`; dense padding; `thead` `sticky top-0 bg-bg-alt`; `th` uses `scope="col"`; row borders via `border-border`
- [ ] **Task 6: StatusChip + badge tokens** (AC: #6, #8)
  - [ ] In `globals.css`, expose per-theme badge backgrounds in `@theme inline` using `color-mix`, e.g. `--color-badge-success: color-mix(in srgb, var(--status-success) 14%, transparent);` for success/info/warning/danger/premium (replaces the dark-only `--badge-*-bg` literals as flagged in deferred-work.md)
  - [ ] `apps/web/src/components/ui/status-chip.tsx` — `status` prop → `bg-badge-<status> text-<status>`, `rounded-full`, small padding, optional leading lucide icon (`aria-hidden`); verify AA contrast both themes
- [ ] **Task 7: Barrel + showcase** (AC: #1, #9)
  - [ ] `apps/web/src/components/ui/index.ts` re-exports all five primitives
  - [ ] Update `apps/web/src/app/page.tsx` to showcase: Button (all variants/sizes/fullWidth + an icon), a labelled Input, a Card, a Table with ~3 sample rows, and all 5 StatusChips — keep the `ThemeToggle` so both themes are checkable
- [ ] **Task 8: Verify** (AC: #8, #9)
  - [ ] `pnpm build` / `pnpm typecheck` / `pnpm lint` green
  - [ ] `pnpm dev` → visually confirm each primitive in dark AND light; check keyboard focus rings; eyeball chip/text contrast
  - [ ] Spot-check contrast ratios for StatusChip text-on-badge and Button primary text-on-primary in both themes; note the measured ratios in the Dev Agent Record

## Dev Notes

- **Builds directly on Story 1.2.** The token utilities already exist (from `globals.css` `@theme inline`): `bg-bg`, `bg-bg-card`, `bg-bg-alt`, `bg-bg-input`, `text-text`, `text-text-muted`, `text-text-dim`, `text-heading`, `border-border`, `border-border-focus`, `text-primary`/`bg-primary`, `text-accent`, and status utilities `text-success|info|warning|danger|premium`. **Reuse these — do not hardcode hex.** 8px radius = Tailwind `rounded-lg`. [Source: apps/web/src/app/globals.css]
- **Component location & naming:** primitives go in `apps/web/src/components/ui/` (per architecture: `components/ui` = design-system primitives). Files `kebab-case.tsx`, components `PascalCase`. The existing `apps/web/src/components/theme-toggle.tsx` is a composite and stays where it is (do not move it in this story). [Source: architecture.md#Implementation-Patterns; architecture.md#Project-Structure]
- **Variant tooling (shadcn-standard, per architecture's shadcn/ui direction):** use `class-variance-authority` for variants and a `cn()` = `twMerge(clsx())` helper so caller `className` overrides merge cleanly. This is the canonical pattern these primitives (and future ones in 1.4) will follow. [Source: architecture.md#Frontend-Architecture]
- **DESIGN_SYSTEM.md component rules (authoritative):** Cards 8px radius, 1px border, subtle shadow only where hierarchy needs it. Buttons 8px radius, clear icon + label for important commands. Inputs 8px radius, visible focus border using `--border-focus`. Tables dense but readable, **sticky headers** for large admin screens. Icons: use `lucide-react`. [Source: DESIGN_SYSTEM.md#Component-Style, #Icons]
- **Prototype parity (visual reference):** the prototype implements these as CSS classes — see `prototype/styles.css` and the catalog in `docs/component-inventory.md` (Button `.btn` primary/ghost/small/full, `.status` chips success/info/warning/danger, dense tables, inputs with focus border). Match the look, but implement as React + token utilities. [Source: docs/component-inventory.md; prototype/styles.css]
- **StatusChip badge backgrounds — resolves a 1.2 deferral:** Story 1.2 left `--badge-*-bg` as dark-only RGBA literals that don't adapt to light. Replace with `color-mix(in srgb, var(--status-<x>) 14%, transparent)` exposed via `@theme inline` as `--color-badge-<x>`, so `bg-badge-success` etc. track the per-theme status color. Confirm `color-mix` renders (all current evergreen browsers support it; it is fine for a PWA target). [Source: deferred-work.md "code review of story-1.2"]
- **Accessibility specifics:** Button must be a native `<button>` (not a div); Input must be focus-visible and pair with a real `<label htmlFor>`; Table `th` needs `scope="col"`; decorative lucide icons get `aria-hidden="true"` (icons that carry meaning need an accessible name). Focus indicator color is `--border-focus` (== primary, deliberate). [Source: DESIGN_SYSTEM.md; NFR11]
- **Testing:** there is still no web unit-test runner (Vitest/RTL arrives with the test harness — Story 1.9 / `tea`). Verify via `pnpm build/typecheck/lint` + the visual showcase + a `pnpm dev` keyboard/contrast pass, and record contrast measurements. Do **not** stand up a test runner in this story (scope creep).

### Latest Tech Notes (verified 2026-06-05)

- **lucide-react** latest is the 1.x line (≈1.17, May 2026). Its declared peer dep still lists React `^16/17/18`, so **pnpm will print a peer-dependency warning** under React 19 — this is expected and non-fatal (the library is functionally React-19 compatible; tree-shaken per-icon imports). Do not pin React down or add `--force`; the warning is acceptable. If install hard-fails, add a `pnpm.overrides`/`peerDependencyRules.allowedVersions` entry rather than downgrading React. [Source: npmjs.com/package/lucide-react]
- **tailwind-merge** 3.6.x supports Tailwind v4 (v4.0–v4.3) — compatible with our Tailwind v4 setup. **clsx** and **class-variance-authority** are utility-lib-agnostic and stable. [Source: github.com/dcastil/tailwind-merge]

### Project Structure Notes

- New: `apps/web/src/lib/cn.ts`, `apps/web/src/components/ui/{button,input,card,table,status-chip}.tsx`, `apps/web/src/components/ui/index.ts`.
- Modified: `apps/web/src/app/globals.css` (badge-bg tokens), `apps/web/src/app/page.tsx` (showcase), `apps/web/package.json` (4 deps).
- No changes to `apps/api` or `packages/*`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3] — story + ACs (UX-DR3/4/5/9, NFR11)
- [Source: DESIGN_SYSTEM.md#Component-Style] — radii, borders, button/input/table rules
- [Source: DESIGN_SYSTEM.md#Icons] — lucide-react + recommended icon mapping
- [Source: apps/web/src/app/globals.css] — token utilities available from Story 1.2
- [Source: docs/component-inventory.md] — prototype component catalog for visual parity
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture] — shadcn/ui + lucide-react + cva direction
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — StatusChip badge backgrounds + contrast (this story closes it)

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-06-05 | Story drafted (create-story). |
