# SommyComfort

Accommodation / rental-operations **PWA** — monorepo (pnpm + Turborepo).

See planning artifacts in [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/) (PRD, architecture, epics, data model) and generated docs in [`docs/`](docs/).

## Structure

```
apps/
  web/    Next.js 16 (App Router) + React 19 + Tailwind v4 — guest + staff PWA
  api/    NestJS 11 — REST API (Socket.IO + queues land in later stories)
packages/
  shared/ @sommycomfort/shared — shared types, Zod schemas, money/date utils
  db/     @sommycomfort/db — Prisma schema + client (added in Story 1.8)
  config/ @sommycomfort/config — shared tsconfig / eslint / tailwind presets
```

## Prerequisites

- Node.js 24 LTS (`.nvmrc`)
- pnpm (pinned via `packageManager` in `package.json`; enable with `corepack enable`)

## Commands

```bash
pnpm install      # install the whole workspace
pnpm dev          # run web + api together (Turborepo)
pnpm build        # build all packages/apps
pnpm lint         # lint all
pnpm typecheck    # typecheck all
```

Run a single app: `pnpm --filter @sommycomfort/web dev` or `pnpm --filter @sommycomfort/api start:dev`.
