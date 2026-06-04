# Deferred Work

## Deferred from: code review of story-1.1 (2026-06-05)

- **Approve `sharp` (and `unrs-resolver`) native build scripts before image optimization ships.** Currently in `pnpm-workspace.yaml` `ignoredBuiltDependencies`. Harmless now (no `next/image` usage), but `next/image` optimization needs `sharp`'s native binary. Run `pnpm approve-builds` and re-install when the first image feature lands (likely Epic 4 guest catalog).
- **Consider TypeScript project references for `packages/shared` / `packages/db`.** They currently expose types only via built `dist`, so running `tsc` directly in an app *before* a build (outside the Turborepo `^build` ordering) fails to resolve the shared types. Turbo handles this today; project references (or a `dev`-time `types`→`src` condition) would make editor/direct-`tsc` resolution robust if the team ever bypasses turbo.
