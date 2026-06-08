---
baseline_commit: cb5faa03fec9293f4fb5676429ca9365e8528788
---

# Story 1.8: Shared contracts, realtime, and data plumbing

Status: done

> **Senior Developer Review (AI) — 2026-06-08 (Epic 1 close, light pass on surviving parts).** Outcome: Approved. The NestJS/Prisma/Socket.IO deliverables are superseded (see banner below) and were not deeply reviewed. The **surviving** shared layer (`packages/shared/src/contracts.ts` + money utils) is clean: correct zod 4 API (`z.uuid()`/`z.iso.datetime()`/`z.coerce`), framework-agnostic `ok`/`fail`/envelope types that remain valid under Convex, well-tested. One Low patch applied: `isoUtcSchema` → `z.iso.datetime({ offset: false })` to make the UTC-only intent explicit. Status → done (note: the backend work it nominally covers is superseded; marking done closes Epic 1, with the Convex replacement tracked separately).

> **⚠️ SUPERSEDED (backend) — Convex (2026-06-08).** The NestJS-specific deliverables of this story — `PrismaService`/`PrismaModule`, the Prisma 7 schema + pg adapter, `ConfigModule`, the Socket.IO `RealtimeGateway`, and `GET /api/v1/health` — are **superseded by the Convex backend** (`packages/backend/convex/`; see the Backend Platform Addendum in `architecture.md`). What survives: the shared **money/util layer** and the idea of a typed contract (now Convex `v.*` validators + shared domain helpers). The `AuditLog` Prisma model maps to the Convex `auditLogs` table. `apps/api` (NestJS) is kept temporarily and slated for removal. This story file is retained as history.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want shared Zod schemas, the Socket.IO base, and the Prisma client wired,
so that later features have a typed contract, a live channel, and DB access ready.

> **Right-scoped (no Docker/Postgres in this environment — same blocker as Story 1.11).** Everything that can be built and verified **offline** is in scope: the Prisma schema + generated client, the NestJS Prisma/Config/health/Socket.IO wiring, and the shared Zod contract. What needs a **running PostgreSQL** is explicitly deferred:
> - **Live Prisma connect + `prisma migrate` applied to a real DB** → deferred to a real-DB/CI pass (Story 1.9 / when Docker is available). The schema + `prisma generate` (no DB needed) ship now; the health endpoint reports `db: "down"` gracefully when no DB is reachable, so the API still boots.
> - **Real JWT handshake auth on the Socket.IO gateway** → JWT/RBAC land in Epic 2 (AR6). The gateway ships with the auth **seam** (a connection guard that rejects tokenless handshakes) and a documented plug-point; full verification is deferred.
> - **Redis + BullMQ queues** (AR3 async/jobs) are **not** in this story's AC (only the Socket.IO gateway is) → deferred to the first feature that needs a job (notifications/payments, Epic 5/10).
> - **Per-story tables:** per AR4 + `data-model.md`, tables are created only when first needed. This story creates **only `AuditLog`** (cross-cutting, AR9) to prove the conventions; identity/property/booking tables are created by their owning stories (Epic 2+).

## Acceptance Criteria

1. **Shared Zod contract (AR5).** `packages/shared` exports Zod schemas + inferred types as the single web↔api contract: a reusable response **envelope** (`{ data, meta }` success / `{ error: { code, message, details } }` error), common primitives (e.g. a UUID id schema, a pagination query schema), and at least one concrete schema exercised by the API (the health response). Money utilities (`toCents`/`fromCents`/`formatKes`) are preserved and a date helper enforces **ISO-8601 UTC**. Both `apps/web` and `apps/api` can import from `@sommycomfort/shared` with no duplication.
2. **Prisma schema + client (AR4).** `packages/db/prisma/schema.prisma` exists with a `postgresql` datasource (`env("DATABASE_URL")`), a Prisma 7 client generator, and the `AuditLog` model following the `data-model.md` conventions (UUID v7 `id`, `snake_case` `@@map`/`@map`, `created_at`, JSON before/after, indexes). `prisma generate` succeeds (no DB required) and `packages/db` exports the typed `PrismaClient`. An `.env.example` documents `DATABASE_URL`.
3. **Prisma wired into Nest (AR4, NFR10).** A `PrismaModule` + `PrismaService` (extends `PrismaClient`, connects on module init, disconnects on shutdown) is provided to the app. Connection failure when no DB is reachable is handled gracefully (logged, does not crash boot) so the API starts in this environment.
4. **Typed config + global API shape.** A config module validates env with Zod (fails fast on bad/missing required env), the app uses the global `/api/v1` prefix, and a global validation pipe enforces the shared Zod schemas on inputs. Responses/errors follow the documented envelope.
5. **Health endpoint (NFR10).** `GET /api/v1/health` returns `200` with `{ data: { status: "ok", db: "up" | "down" } }` — `db` reflects an actual Prisma ping (`SELECT 1`), returning `"down"` (not a 5xx) when no DB is reachable.
6. **Socket.IO gateway (AR3).** A NestJS Socket.IO gateway accepts WebSocket connections and **rejects handshakes with no auth token** (the auth seam for Epic 2 JWT); the room-scoping (property + role) and server-authoritative+persisted event model are documented. Wiring proven by a unit test of the connection handler (mocked socket) — no real JWT yet.
7. **Green + no regressions.** New deps (`zod`, `@prisma/client`/`prisma`, `@nestjs/websockets`/`@nestjs/platform-socket.io`/`socket.io`, `@nestjs/config` or a typed env util) install cleanly. `pnpm build/typecheck/lint/test` stay green across all packages, including new tests for the shared schemas, the health endpoint (ok + db:down path), the config validation, and the gateway connection guard. `packages/db` gains a `test` script (closes the 1.11 follow-up).

> Out of scope: any identity/property/booking tables (their owning stories), real JWT verification + RBAC (Epic 2), Redis/BullMQ jobs (later), applying migrations to a live DB (deferred — see right-scope note), OpenAPI/Swagger doc generation (nice-to-have; add when endpoints exist).

## Tasks / Subtasks

- [x] **Task 1: Shared Zod contract** (AC: #1) — add `zod` to `packages/shared`; create `src/contracts/` (or `src/schemas.ts`): response-envelope types + helpers (`ok(data, meta)`, error shape with `code`/`message`/`details`), `idSchema` (uuid), `paginationQuerySchema`, and `healthResponseSchema`. Add an ISO-8601 UTC date helper (e.g. `toIsoUtc(date)`). Re-export all from `src/index.ts`. Keep `toCents`/`fromCents`/`formatKes`.
- [x] **Task 2: Prisma schema + client** (AC: #2) — add `prisma` (dev) + `@prisma/client` to `packages/db`; create `prisma/schema.prisma` (datasource `postgresql` `env("DATABASE_URL")`, generator `prisma-client-js`, `AuditLog` model per `data-model.md`). Add scripts: `db:generate` (`prisma generate`), `db:migrate` (`prisma migrate dev` — documented as needing a DB), and wire `prisma generate` into `build`. Export `PrismaClient` (+ types) from `src/index.ts`. Add `packages/db/.env.example` with `DATABASE_URL`. Run `prisma generate` and commit `schema.prisma` (NOT generated client output).
- [x] **Task 3: PrismaService + module** (AC: #3) — `apps/api/src/prisma/{prisma.service.ts,prisma.module.ts}`: `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy`; `onModuleInit` tries `$connect()` inside try/catch (log + continue on failure so boot survives a missing DB here); `enableShutdownHooks`/`onModuleDestroy` calls `$disconnect()`. Export a global `PrismaModule`.
- [x] **Task 4: Typed config + global API shape** (AC: #4) — add config (env) validation with Zod (a `ConfigModule` using `@nestjs/config` `validate`, or a small typed `env` util in `packages/shared`); register globally. In `main.ts`: `app.setGlobalPrefix('api/v1')`, `app.enableShutdownHooks()`, and a global Zod validation pipe. Define the response envelope (a response interceptor + an exception filter producing `{ error: { code, message, details } }`), or document the contract + apply at controller level.
- [x] **Task 5: Health endpoint** (AC: #5) — `apps/api/src/health/{health.controller.ts,health.module.ts}`: `GET /api/v1/health` injects `PrismaService`, runs `SELECT 1` (try/catch → `db: 'up'|'down'`), returns `{ data: { status: 'ok', db } }` validated against `healthResponseSchema`. Always `200` (db state in the body, not the status code).
- [x] **Task 6: Socket.IO gateway** (AC: #6) — add `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io`; `apps/api/src/realtime/{realtime.gateway.ts,realtime.module.ts}`: a gateway whose `handleConnection` reads `socket.handshake.auth.token` (or `Authorization`) and **disconnects** if absent (the Epic-2 JWT seam — add a `// TODO(Epic 2): verify JWT` plug-point). Document room-scoping (property+role) and server-authoritative+persisted events in comments. Register the module.
- [x] **Task 7: Tests + verify** (AC: #1–#7) — shared: Zod schema parse/round-trip + date-util tests. api (Vitest + unplugin-swc, reflect-metadata setup): health controller (ok + db:down via a mocked PrismaService), config validation (rejects bad env), gateway `handleConnection` (rejects tokenless, accepts tokened — mocked socket). Add `test` script to `packages/db`. Keep `app.controller.spec` green. Run `pnpm build/typecheck/lint/test` — all green.

## Dev Notes

### Architecture compliance (the binding rules)
- **AR3 — API stack:** NestJS 11 REST under `/api/v1` + Socket.IO gateway; Redis + BullMQ. This story does the `/api/v1` prefix + Socket.IO base; **Redis/BullMQ deferred** (no job yet). [Source: epics.md AR3; architecture.md#API-&-Communication-Patterns]
- **AR4 — Data:** PostgreSQL 18 + Prisma 7; UUID v7 keys; `snake_case` DB ↔ `camelCase` TS via `@@map`/`@map`. **Tables created only by the first story that needs them** — so create only `AuditLog` now. Field-level schema is `data-model.md`. [Source: epics.md AR4; data-model.md#Conventions]
- **AR5 — Shared contract:** Zod schemas in `packages/shared` are the single web↔api contract; money via the shared integer-cents utility; dates **ISO-8601 UTC**. Reused for API DTO validation (Zod pipe in Nest) and RHF resolvers on web. [Source: epics.md AR5; architecture.md#Data-Architecture]
- **AR9 — Audit-first:** every money/sensitive mutation writes an `audit_log` row. We create the table now; the write-helper lands with the first mutating feature (Epic 2). [Source: epics.md AR9]
- **Response envelope (binding):** success → `{ "data": ..., "meta": {...} }`; error → `{ "error": { "code": "STRING_CODE", "message": "...", "details": [...] } }`. Domain conflicts → `409`. [Source: architecture.md#API-&-Communication-Patterns]
- **Realtime model (binding):** Socket.IO rooms scoped by **property + role**; events are **server-authoritative and persisted** (clients reconcile on reconnect). Encode this in gateway comments now; channels (housekeeping/kitchen/calendar/dashboard) are wired by their feature epics. [Source: architecture.md#API-&-Communication-Patterns]

### Data-model conventions to copy exactly (AuditLog)
From `data-model.md`: `id String @id @default(dbgenerated("uuidv7()")) @db.Uuid`, `actorId String? @map("actor_id") @db.Uuid`, `action String`, `entityType String @map("entity_type")`, `entityId String? @map("entity_id")`, `before Json?`, `after Json?`, `ip String?`, `createdAt DateTime @default(now()) @map("created_at")`, `@@index([entityType, entityId])`, `@@index([actorId, createdAt])`, `@@map("audit_logs")`. **`uuidv7()`** is a native PostgreSQL 18 function — fine for the schema; it only executes against a real DB (deferred), `prisma generate` does not need it. [Source: data-model.md#R1-Identity-&-Access]

### Existing code — reuse / preserve
- `packages/shared/src/index.ts` already has `APP_NAME`, `DEFAULT_CURRENCY`, `toCents`/`fromCents`/`formatKes` — **extend, don't replace**; its comment already says "Story 1.8 expands this with Zod schemas." [Source: packages/shared/src/index.ts]
- `packages/db/src/index.ts` is a stub (`DB_PACKAGE`) explicitly "reserved … until Story 1.8 … wires up Prisma 7" — replace the stub with the real client export. [Source: packages/db/src/index.ts]
- `apps/api/src/{app.module,app.controller,app.service,main}.ts` — keep the existing `getHello` (and its passing spec); add the new modules to `AppModule.imports`. `main.ts` currently listens on `PORT ?? 3001` with `reflect-metadata` imported first — preserve both. [Source: apps/api/src/main.ts, app.module.ts]
- **api test harness:** Vitest + `unplugin-swc` (legacyDecorator + decoratorMetadata) with `setupFiles: ["reflect-metadata"]` — NestJS DI works in tests (see `app.controller.spec.ts`). The 1.11 follow-up notes property-injection / DTO-validation metadata is the likely first gap — the new tests (PrismaService injection, gateway, config) exercise exactly that, so watch for missing decorator metadata. [Source: apps/api/vitest.config.ts; deferred-work.md story-1.11]

### Packaging notes
- `packages/shared` and `packages/db` are `"type": "commonjs"`, expose built `dist` via `exports`, and are consumed through Turborepo `^build` ordering. Adding `zod` to shared and `@prisma/client` to db means the api/web dev-time `tsc` still relies on built `dist` (1.1 deferred-work flagged direct-tsc-before-build). Keep `prisma generate` in db's `build` so the client type exists before dependents typecheck.
- **Monorepo build scripts** flagged in 1.11: verify `@prisma/client` postinstall/generate works in CI later (Story 1.9). For now `db:generate` must run before `db` typechecks.

### Next.js / Nest version caveats
- NestJS 11 + `@nestjs/platform-socket.io` — confirm the Socket.IO adapter is the default for `@WebSocketGateway`; if a custom `IoAdapter` is needed it's `app.useWebSocketAdapter(new IoAdapter(app))` in `main.ts`. Verify against installed `@nestjs/websockets` version.
- Prisma 7: confirm the generator block + client import path (`@prisma/client`) against the installed 7.x; the `prisma` CLI is invoked via package scripts (`pnpm --filter @sommycomfort/db db:generate`).

### Project Structure Notes
- **New:** `packages/shared/src/contracts/*` (or `schemas.ts`) + tests; `packages/db/prisma/schema.prisma`, `packages/db/.env.example`, `packages/db/src/index.ts` (rewritten), `packages/db` test(s); `apps/api/src/{prisma,health,realtime,config}/*` + tests.
- **Modified:** `packages/{shared,db}/package.json` (deps + scripts), `apps/api/package.json` (deps), `apps/api/src/{app.module,main}.ts`, root `.env.example` if present.
- No changes to `apps/web` beyond (optionally) consuming a shared schema in a later story; this story keeps web green.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.8] — story + AC (AR3, AR4, AR5, NFR10) and AR definitions.
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture, #API-&-Communication-Patterns] — Prisma/Postgres, envelope, realtime model, Zod contract.
- [Source: _bmad-output/planning-artifacts/data-model.md] — field-level schema + conventions (AuditLog copied exactly; other tables deferred to owning stories).
- [Source: packages/shared/src/index.ts, packages/db/src/index.ts] — stubs to extend/replace.
- [Source: apps/api/src/main.ts, app.module.ts, vitest.config.ts] — wiring + test harness to preserve.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — 1.11 (db test script, CI build-scripts on @prisma/client), 1.1 (direct-tsc-before-build).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- **Prisma 7 breaking changes (read local + error-driven):** `datasource.url` is no longer allowed in `schema.prisma` — moved the connection URL to `prisma.config.ts` (`defineConfig`). `prisma/config`'s `env()` throws eagerly on a missing var, which blocked offline `prisma generate`; switched to `process.env.DATABASE_URL` with a conditional `datasource` so generate works with no DB and migrate still requires the URL. Prisma 7 runtime requires a **driver adapter** → `@prisma/adapter-pg` + `pg`; `PrismaPg` constructor takes a connection string / PoolConfig / Pool.
- `prisma generate` succeeds offline (queryCompiler client — no native engine binary needed with driver adapters; pnpm's blocked `@prisma/engines`/`prisma` build scripts are therefore irrelevant to generate/runtime, only to `prisma migrate`'s schema engine — noted in deferred-work).
- **Lint (type-aware) fixes:** `no-unsafe-enum-comparison` on the status→code `switch` (eslint `--fix` kept stripping the `as HttpStatus` cast as "unnecessary", re-tripping the rule) → replaced with a numeric-keyed `Record` lookup. `no-unsafe-assignment` on socket.io's `handshake.auth.token` (`any`) → typed the local as `unknown` before the `typeof` guard. Test mocks: `require-await` → `() => Promise.resolve/reject(...)`; `unbound-method` → destructure the `vi.fn()` `disconnect` instead of asserting on `socket.disconnect`.
- **Verification:** `pnpm test` 6/6 tasks (**shared 13, db 2, api 10** [+9: health 2, env 4, gateway 3], web 36); `typecheck` 6/6; `lint` 4/4; `build` 4/4 (Prisma client generated, nest build, web webpack/SW). **Smoke (no DB):** `GET /api/v1/health` → `{"data":{"status":"ok","db":"down"}}`; `GET /api/v1` → greeting; unknown route → `{"error":{"code":"NOT_FOUND",...}}`.

### Completion Notes List

- **All 7 ACs satisfied** (right-scoped: live-DB connect/migrate deferred, no-DB boot proven by smoke test).
- **AC1 — shared contract:** `packages/shared/src/contracts.ts` exports the response envelope (`ok`/`fail`, `ApiSuccess`/`ApiErrorBody`/`ApiMeta`), `idSchema` (`z.uuid()`), `paginationQuerySchema`, `healthResponseSchema`, `isoUtcSchema` + `toIsoUtc` (ISO-8601 UTC). Money utils preserved. zod 4 API used (`z.uuid()`, `z.iso.datetime()`, `z.coerce`). Imported by the API health controller — single contract, no duplication.
- **AC2 — Prisma:** `packages/db/prisma/schema.prisma` (postgresql datasource [provider only, Prisma-7 style], prisma-client-js generator, `AuditLog` copied exactly from `data-model.md` — uuidv7, snake_case maps, JSON, indexes). `prisma.config.ts` holds the URL. `db:generate`/`db:migrate` scripts + `prisma generate` in `build` + `postinstall` (client always present before dependents). `.env.example` added. `src/index.ts` exports `PrismaClient`/`Prisma`/`AuditLog`.
- **AC3 — PrismaService:** extends `PrismaClient` with the pg adapter; `onModuleInit` `$connect()` in try/catch (logs + continues so boot survives no DB); `onModuleDestroy` `$disconnect()`; global `PrismaModule`.
- **AC4 — config + API shape:** `ConfigModule.forRoot({ isGlobal, validate: validateEnv })` (zod env, fails fast; `DATABASE_URL` optional so boot works here); `main.ts` sets `/api/v1` prefix + `enableShutdownHooks()` + the global `AllExceptionsFilter` (error envelope). `ZodValidationPipe` provided for per-endpoint input validation (the contract; first real use lands with the first DTO endpoint).
- **AC5 — health:** `GET /api/v1/health` pings via `$queryRaw\`SELECT 1\``, returns `{ data: { status:'ok', db } }` validated by `healthResponseSchema`; always 200 (verified `db:down` in smoke). NB: with the lazy pg pool, `$connect()` resolves even without a DB (boot log says "connected") — the **real** DB state is reported by the health ping; eager-ping logging accuracy noted as a minor deferral.
- **AC6 — gateway:** `RealtimeGateway` (`@WebSocketGateway`) rejects tokenless handshakes (`disconnect(true)`), accepts handshake-auth or `Bearer` header; room-scoping (property+role) + server-authoritative+persisted events documented; `// TODO(Epic 2 / AR6)` JWT plug-point. 3 unit tests.
- **AC7 — green + no regressions:** all gates green; `packages/db` gained `test` (closes a 1.11 follow-up); existing `app.controller.spec` still passes; `GET /api/v1` greeting preserved.
- **Deferred (recorded in deferred-work.md):** live Prisma connect + first migration (real DB/CI, 1.9); approve pnpm `prisma`/`@prisma/engines` build scripts for the migrate schema engine in CI; real JWT socket auth (Epic 2); Redis/BullMQ (first job); eager health-ping logging accuracy.

### File List

**New (shared):** `packages/shared/src/contracts.ts` + `contracts.test.ts`
**New (db):** `packages/db/prisma/schema.prisma`, `packages/db/prisma.config.ts`, `packages/db/.env.example`, `packages/db/vitest.config.ts`, `packages/db/src/index.test.ts`
**New (api):** `apps/api/src/prisma/{prisma.service,prisma.module}.ts`; `apps/api/src/config/env.ts` + `env.spec.ts`; `apps/api/src/common/{zod-validation.pipe,all-exceptions.filter}.ts`; `apps/api/src/health/{health.controller,health.module}.ts` + `health.controller.spec.ts`; `apps/api/src/realtime/{realtime.gateway,realtime.module}.ts` + `realtime.gateway.spec.ts`

**Modified:** `packages/shared/src/index.ts` (+ contracts export), `packages/shared/package.json` (zod); `packages/db/src/index.ts` (PrismaClient export), `packages/db/package.json` (prisma/@prisma/client + scripts), `packages/db/tsconfig.json` (exclude tests); `apps/api/package.json` (deps); `apps/api/src/{app.module,main}.ts`
**Modified (tracking/docs):** `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

| Date | Change |
|---|---|
| 2026-06-08 | Story drafted (create-story), right-scoped: offline plumbing now; live-DB connect/migrate, JWT socket auth, Redis/BullMQ deferred. |
| 2026-06-08 | Implemented: shared Zod contract (envelope + primitives + health + ISO date), Prisma 7 schema/`prisma.config.ts`/client (`AuditLog`) with pg driver adapter, Nest `PrismaService`/`ConfigModule`/`/api/v1`/`AllExceptionsFilter`/`ZodValidationPipe`, `GET /api/v1/health`, `RealtimeGateway` (auth seam). 18 new tests; all gates green; no-DB boot smoke-verified. Status → review. |
