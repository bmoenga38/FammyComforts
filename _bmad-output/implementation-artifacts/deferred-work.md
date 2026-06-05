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
