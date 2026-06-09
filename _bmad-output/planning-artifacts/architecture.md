---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - PRD.md
  - DESIGN_SYSTEM.md
  - DEVELOPMENT_PHASES.md
  - DEMO_REVIEW_REPORT.md
  - docs/index.md
  - docs/architecture.md
  - docs/project-overview.md
  - docs/component-inventory.md
workflowType: 'architecture'
project_name: 'Fammy Comforts'
user_name: 'Brian'
date: '2026-06-04'
lastStep: 8
status: 'complete'
completedAt: '2026-06-04'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

> **Run mode note:** This document was produced via the BMAD `create-architecture` workflow in autonomous ("YOLO") mode. The facilitator made the decisions below on Brian's behalf, grounded in `PRD.md` and the generated `docs/`. Every decision is a reasonable default for the stated requirements — review and override any you disagree with (especially backend framework, payments, and hosting).

---

## ⚠️ Backend Platform Addendum — Convex (supersedes 2026-06-08)

**Decision (Brian, 2026-06-08): the backend is built on [Convex](https://convex.dev), not the NestJS/Prisma/PostgreSQL stack described below.** Where the sections that follow (and AR3/AR4/AR6/AR7/AR8) describe NestJS + Prisma + PostgreSQL + Socket.IO + Redis/BullMQ + S3, **this addendum overrides them.** The original text is kept for history; treat it as superseded.

**Convex project:** `bry-code/sommycomfort` — Development deployment `quixotic-boar-465`, Production deployment `notable-cod-441` (dashboards in the team's records / the `sommycomfort-convex-backend` memory).

### What Convex replaces (concern → mechanism)

| Concern | Was (superseded) | Now — Convex |
|---|---|---|
| API / business logic | NestJS 11 REST `/api/v1` + OpenAPI | Convex **functions**: `query` (reactive reads), `mutation` (transactional writes), `action` (side-effects / external calls, e.g. M-Pesa) |
| Database + ORM | PostgreSQL 18 + Prisma 7 | Convex **document DB** + `convex/schema.ts` (`defineSchema`/`defineTable` + `v.*` validators); ACID transactions in mutations |
| IDs | UUID v7 | Convex document `_id` (typed `Id<"table">`) + `_creationTime` |
| Realtime | Socket.IO gateway, rooms by property+role | **built-in** — every `query` is a live subscription; clients re-render on data change automatically |
| Async / jobs | Redis + BullMQ | Convex **scheduler** (`ctx.scheduler.runAfter/runAt`) + **crons** (`convex/crons.ts`) |
| Auth | JWT + rotating refresh + argon2id + `PermissionsGuard` | **Convex Auth** (`@convex-dev/auth`) for identity; app-level roles/permissions enforced **inside** each function via `ctx.auth` + a `userRoles`/permission check helper |
| File storage | S3 / MinIO + signed URLs | Convex **file storage** (`ctx.storage.generateUploadUrl()` / `getUrl()`) |
| Validation contract (AR5) | shared Zod schemas as the web↔api DTO contract | Convex **argument validators** (`v.*`) are the server contract + generate end-to-end types via `convex/_generated`. Shared **domain** helpers (money integer-cents, KES formatting, status enums) still live in `packages/shared`; Zod may still validate web forms (React Hook Form), but the server boundary is Convex validators, not Zod DTOs |
| Money / audit (AR9) | `amount_cents BIGINT`, `audit_logs` table | same invariants: store integer minor units (`v.int64()` or number-of-cents), keep an `auditLogs` table written from mutations |

### Revised architecture requirements

- **AR3′ — Backend:** Convex functions (query/mutation/action) replace the NestJS REST API + Socket.IO + Redis/BullMQ. No `/api/v1` REST surface for first-party clients (Convex client calls functions directly); HTTP **actions** (`convex/http.ts`) are used only for inbound webhooks (e.g. M-Pesa callback).
- **AR4′ — Data:** Convex document DB; schema in `convex/schema.ts`; tables added **per-story when first needed** (unchanged principle). `data-model.md` entities still apply — re-expressed as Convex tables (relations via `Id<"...">` fields + indexes).
- **AR6′ — Auth:** Convex Auth for identity; RBAC enforced in-function (a shared `requirePermission(ctx, area, action)` helper) — the permission **model** from `PRD.md`/`data-model.md` is unchanged, only the enforcement point moves.
- **AR7′ — Integrations:** M-Pesa STK push + callback via Convex **actions** + an **HTTP action** webhook; object storage = Convex file storage (drop S3/MinIO for MVP); email/SMS/WhatsApp/web-push via actions (+ scheduler).
- **AR8′ — CI/CD:** Web CI gates unchanged (lint/typecheck/Vitest/Playwright). Backend deploy = **`convex deploy`** (per-deployment: dev `quixotic-boar-465`, prod `notable-cod-441`) — **not** Docker images / `prisma migrate`. No Postgres/Redis/MinIO containers; `docker-compose.yml` becomes optional/only-if-needed.

### Repo & web impact

- **Backend lives at `packages/backend/convex/`** (the Convex deployment root). `apps/api` (NestJS) is **superseded** — kept temporarily, to be removed once nothing depends on it.
- **Web** stays Next.js 16 + React 19 + Tailwind v4. Add `convex` + `ConvexProvider` (`convex/react`) wired from `NEXT_PUBLIC_CONVEX_URL`; use `useQuery`/`useMutation`. TanStack Query (Story 1.6) is no longer the primary server-state layer for Convex data (Convex queries are reactive) — keep it only for any non-Convex fetches.
- **Offline (NFR2/NFR3/NFR5):** Convex has its own client cache + reconnection; the offline **indicator** (Story 1.6) stays. Revisit the offline **mutation queue** strategy against Convex's client behavior when the first mutations land.
- **Testing:** use `convex-test` (+ Vitest) for function unit tests; keep the existing web Vitest/Playwright harness.

### Story impact (already built under the old stack)

- **Story 1.8** (NestJS `PrismaService` / `ConfigModule` / Socket.IO `RealtimeGateway` / `/api/v1/health` / pg adapter) is **largely superseded** by the Convex backend. The shared money/util layer survives; the Prisma schema (`AuditLog`) maps to a Convex `auditLogs` table.
- **Story 1.9** — drop the **api** Dockerfile + `postgres/redis/minio` compose + `prisma migrate deploy`; backend ships via `convex deploy`. Keep the web CI gates + Playwright; add a `convex deploy` step (gated on `CONVEX_DEPLOY_KEY`).

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
Fammy Comforts is a full accommodation/rental operations platform. Functionally it spans eight role-based surfaces (`PRD.md` §4–§5): Guest PWA (public catalog, availability search, no-account booking, ID capture, split payments, confirmation, booking lookup), Admin Portal (property/room/rate/tax/policy config, staff & RBAC, payment-method config, booking-source management, audit logs), Front Desk (booking CRUD, guest profiles, calendar, check-in/out, extend/change/cancel/no-show/refund, split payments), Operations/Caretaker (mobile daily ops, room-readiness board, housekeeping assignment, maintenance/damage with photos, asset checks, escalations), Housekeeping (task queue, checklists, photo proof, offline updates), Inventory (catalog, suppliers, purchases, stock movements, stocktake, low-stock alerts), Restaurant/Room-Service (menu linked to inventory, order lanes, charges-to-room), and Reporting (revenue, occupancy, P&L, inventory, restaurant, guests, tax/VAT, assets).

**Non-Functional Requirements:**
The NFRs (`PRD.md` §6, §9, §11) are the real architecture drivers: installable **PWA** with offline shell + offline-capable task updates + background sync + push; **near-real-time** updates for housekeeping/kitchen/calendar/dashboard; **strong auth + granular RBAC** across 12 roles × 18 permission areas; **secure handling of identity documents** (encryption in transit, access-controlled storage, retention); **audit logging** for bookings/payments/check-in-out/staff/settings; **PDF + CSV/Excel export**; **low-bandwidth mobile performance** on mid-range Android; Lighthouse PWA ≥ 90; and concrete speed targets (guest booking < 3 min, reception booking < 2 min, check-in/out < 90 s, dashboard reflects change < 5 s).

**Scale & Complexity:**
- Primary domain: **Full-stack web** (installable PWA front end + REST API back end), mobile-first.
- Complexity level: **High** — multi-role RBAC, real-time, payments + reconciliation, offline-first staff flows, financial reporting, and ~28 related data entities.
- Estimated architectural components: ~12 backend domain modules (auth, guests, rooms/rates, bookings, payments, housekeeping, maintenance/assets, inventory, restaurant, reporting, notifications, audit) + a PWA front end with 6+ role workspaces.

### Technical Constraints & Dependencies

- **Kenya market context:** pricing in **KES**, **M-Pesa** is a first-class payment method (Daraja STK push + manual reference capture), plus cash and card/POS.
- **Money correctness:** the demo review (`DEMO_REVIEW_REPORT.md` / `PRD.md` §2) flagged rough fractional-night and balance math — money must be exact and reconcilable (audit + reconciliation rules per the Fammy Comforts Method working rules).
- **Connectivity:** caretakers/housekeeping operate on poor mobile networks → offline queue + background sync are mandatory, not optional.
- **Identity data:** guest ID images/numbers are sensitive → encryption, access control, and retention rules required.
- **Existing assets:** a vanilla-JS prototype (`prototype/`) and a complete design system (`DESIGN_SYSTEM.md`) already define the visual language, tokens, and the six role views — the production front end should reproduce these, not reinvent them.

### Cross-Cutting Concerns Identified

Authentication & RBAC; audit logging; real-time event propagation; offline sync & conflict resolution; money/ledger integrity & reconciliation; file/document storage & access control; notifications (email/SMS/WhatsApp/push); export (PDF/CSV); observability (logging/metrics/tracing); multi-status workflow state machines (booking, room, housekeeping, order).

---

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack TypeScript monorepo** — a PWA front end plus a REST API back end that share types and validation schemas. A monorepo is chosen over two separate repos so the booking/payment/RBAC contracts stay in lockstep between client and server.

### Starter Options Considered

- **create-t3-app** — excellent single-app full-stack (Next + tRPC + Prisma), but it couples front and back into one Next deployment and leans tRPC. Fammy Comforts needs an independently deployable, framework-rich API (queues, websockets gateway, scheduled jobs), so a single Next app is too constraining.
- **RedwoodJS / Blitz** — opinionated full-stack, but smaller ecosystems and less natural fit for a NestJS-style domain backend.
- **Turborepo (`create-turbo`)** — a maintained monorepo scaffold that we extend with a Next.js app and a NestJS app plus shared packages. Maximum control, clean app boundaries, shared types. **Selected.**

### Selected Starter: Turborepo monorepo (pnpm) + Next.js app + NestJS app

**Rationale for Selection:**
Gives independently deployable `web` (PWA) and `api` (REST + realtime + queues) apps while sharing a single source of truth for types and Zod validation schemas. Matches the high-complexity, multi-surface nature of the product and keeps the front-end/back-end contract enforced at compile time.

**Initialization Command:**

```bash
# scaffold the monorepo
pnpm dlx create-turbo@latest sommycomfort --package-manager pnpm
cd sommycomfort

# add the apps
pnpm dlx create-next-app@latest apps/web --typescript --tailwind --app --eslint --src-dir
pnpm dlx @nestjs/cli@latest new apps/api --package-manager pnpm --strict

# shared packages
mkdir -p packages/shared packages/db
```

**Architectural Decisions Provided by Starter:**

- **Language & Runtime:** TypeScript (strict) on Node.js 24 LTS across all apps and packages.
- **Styling Solution:** Tailwind CSS v4 (web), seeded from the `DESIGN_SYSTEM.md` tokens (dark/light, status colors); shadcn/ui primitives + `lucide-react` icons.
- **Build Tooling:** Turborepo task graph + caching; pnpm workspaces; Next/Turbopack for web; Nest build for api.
- **Testing Framework:** Vitest (unit) workspace-wide; Playwright (web e2e); Supertest (api integration).
- **Code Organization:** `apps/web`, `apps/api`, `packages/shared` (types + Zod), `packages/db` (Prisma schema + client), `packages/config` (eslint/tsconfig/tailwind presets).
- **Development Experience:** single `pnpm dev` runs both apps via Turborepo; shared lint/format config; typed env via Zod.

**Note:** Project initialization using these commands should be the **first implementation story**.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):** language/runtime, monorepo layout, frontend framework + PWA strategy, backend framework, database + ORM, auth/RBAC model, money representation, API style.

**Important Decisions (Shape Architecture):** realtime transport, queue/jobs, object storage, payments integration, notifications, offline-sync strategy, state management, validation strategy.

**Deferred Decisions (Post-MVP):** multi-property hierarchy, OTA/channel-manager integration, loyalty, dynamic pricing, WhatsApp provider selection, advanced analytics warehouse. (All explicitly out-of-scope per `PRD.md` §12.)

### Data Architecture

- **Database:** **PostgreSQL 18** (latest stable 18.4, May 2026) — relational integrity for bookings/payments/ledger, strong constraints, JSONB where needed.
- **ORM:** **Prisma 7** (7.4.x, production-recommended) — type-safe client shared from `packages/db`, migrations checked into the repo.
- **IDs:** UUID **v7** primary keys (time-sortable) named `id`; foreign keys `<entity>_id`.
- **Money:** store **integer minor units** (`amount_cents BIGINT`) + `currency` (default `KES`); never floats. All booking/payment math goes through a single money utility in `packages/shared`.
- **Audit & reconciliation:** every money-affecting and sensitive action writes an `audit_log` row (actor, action, entity, before/after, ip, timestamp). Payments reconcile against bookings via a derived ledger; balances are computed, never hand-edited.
- **Validation:** **Zod** schemas in `packages/shared` are the single contract — reused for API DTO validation (via a Zod pipe in Nest) and React Hook Form resolvers on the web.
- **Caching:** Redis for sessions/refresh-token denylist, rate-limit counters, and hot dashboard aggregates; HTTP caching for the public room catalog.

### Authentication & Security

- **AuthN:** JWT **access token (short-lived) + refresh token (rotating)**; refresh tokens stored hashed with a server-side denylist in Redis. Passwords hashed with **argon2id**.
- **AuthZ:** **RBAC with fine-grained permissions** matching `PRD.md` §7 — 12 roles × 18 permission areas. Permissions are checked by a Nest `PermissionsGuard` + `@RequirePermission('bookings:write')` decorator; the web mirrors permissions for UI gating only (server is authoritative).
- **Guest identity data:** ID images stored in access-controlled object storage with signed, short-TTL URLs; ID numbers encrypted at rest (column-level); retention policy + access logged in `audit_log`.
- **Transport/API security:** HTTPS everywhere; Helmet; CORS allowlist; per-route rate limiting; input validated by Zod at the boundary; no secrets in client bundles.

### API & Communication Patterns

- **API style:** **REST** under `/api/v1`, JSON, documented with **OpenAPI** (Nest Swagger). REST over GraphQL for predictable caching, simpler offline replay, and team familiarity.
- **Response envelope:** success → `{ "data": ..., "meta": {...} }`; error → `{ "error": { "code": "STRING_CODE", "message": "human readable", "details": [...] } }`.
- **Status codes:** standard semantics (200/201/204, 400/401/403/404/409/422, 429, 5xx). Domain conflicts (e.g. double-booking) → `409`.
- **Realtime:** **Socket.IO** gateway in NestJS for housekeeping, kitchen, calendar, and dashboard channels; rooms scoped by property + role; events are server-authoritative and also persisted (clients reconcile on reconnect).
- **Async/jobs:** **Redis + BullMQ** queues for notifications, report generation, payment callbacks (M-Pesa), and offline-sync fan-out.

### Frontend Architecture

- **Framework:** **Next.js 16.2** (App Router) + **React 19** + TypeScript.
- **PWA:** service worker via **Serwist** (`@serwist/next`) — offline app shell, runtime caching, background sync queue for housekeeping/maintenance/asset updates; **Web Push** via VAPID for notifications; web app manifest with icons/splash per `DESIGN_SYSTEM.md`.
- **Styling:** **Tailwind CSS v4** themed from the existing design tokens; shadcn/ui + `lucide-react`.
- **Server state:** **TanStack Query** (caching, retries, optimistic updates, offline mutation queue). **Local UI state:** **Zustand**. No Redux.
- **Forms:** **React Hook Form** + Zod resolver (shared schemas).
- **Routing:** App-Router segments per role workspace (`(guest)`, `(staff)`), with route groups guarded by session + permission.

### Infrastructure & Deployment

- **Containerization:** Docker images per app; `docker-compose.yml` for local dev (postgres, redis, minio, api, web).
- **Hosting (MVP):** containers on a single VPS or a PaaS (Render/Railway/Fly.io); managed Postgres + Redis; **S3-compatible** object storage (MinIO in dev, AWS S3 / compatible in prod). Web served behind a CDN.
- **CI/CD:** GitHub Actions — lint + typecheck + Vitest + Playwright on PR; build + push images + migrate + deploy on main.
- **Config:** typed env via Zod (`packages/shared/env`); secrets via the platform's secret store; `.env.example` committed.
- **Observability:** structured JSON logging (pino), request tracing/correlation IDs, error tracking (Sentry), uptime/health endpoints.

### Decision Impact Analysis

**Implementation Sequence:** (1) scaffold monorepo + shared/db packages → (2) Prisma schema + migrations for core entities → (3) auth + RBAC → (4) rooms/rates + guests → (5) bookings + payments (+ M-Pesa) → (6) housekeeping/ops + realtime → (7) inventory + restaurant → (8) reporting + exports → (9) PWA offline/push hardening.

**Cross-Component Dependencies:** RBAC gates every module; the money utility + audit log underpin bookings, payments, inventory, and reporting; the Socket.IO gateway + BullMQ underpin realtime and notifications; shared Zod schemas couple every web form to its API endpoint.

---

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 6 areas where AI agents could diverge — DB naming, API shape, code naming, money/date formats, event naming, and error/loading handling.

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case`, **plural** (`bookings`, `housekeeping_tasks`, `audit_logs`).
- Columns: `snake_case` (`check_in_at`, `amount_cents`). PK `id` (uuid v7). FK `<entity>_id` (`room_id`). Timestamps `created_at`, `updated_at`, soft-delete `deleted_at` (nullable).
- Prisma models: `PascalCase` singular (`Booking`) mapped with `@@map("bookings")` and `@map` on fields → DB stays snake_case, TS stays camelCase.

**API Naming Conventions:**
- Routes: plural nouns under `/api/v1` (`/api/v1/bookings`, `/api/v1/bookings/:id/payments`). Path param `:id`. Query params `camelCase` (`?roomId=&status=`).
- JSON fields: **camelCase** (Prisma already gives camelCase in TS; serialize as-is).
- Headers: `X-` prefix for custom (`X-Request-Id`).

**Code Naming Conventions:**
- React components: `PascalCase` files (`BookingCard.tsx`). Hooks: `useBooking.ts`. Non-component TS files: `kebab-case` (`money-utils.ts`). Functions/vars: `camelCase`. Types/interfaces/enums: `PascalCase`. Constants: `UPPER_SNAKE_CASE`.

### Structure Patterns

**Project Organization:**
- Backend organized **by domain module** (`apps/api/src/modules/<domain>/` with `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `dto/`, `*.gateway.ts`).
- Frontend organized **by feature** (`apps/web/src/features/<feature>/`) with shared primitives in `src/components/ui/`.
- Tests **co-located** as `*.spec.ts` (unit) next to source; e2e in `apps/web/e2e/` and `apps/api/test/`.
- Shared utilities → `packages/shared`; never duplicate types or money/date logic in an app.

**File Structure Patterns:** config presets in `packages/config`; env schema in `packages/shared/env.ts`; Prisma in `packages/db/prisma/`.

### Format Patterns

**API Response Formats:** envelope `{ data, meta }` / `{ error: { code, message, details } }` (as in Core Decisions). Pagination via `meta: { page, pageSize, total }`.

**Data Exchange Formats:**
- Dates/times: **ISO 8601 UTC** strings in APIs; render in local TZ on the client.
- Money: integer `amountCents` + `currency`; format for display only at the edge.
- Booleans: real `true`/`false`. Nulls allowed; omit unknown rather than send empty string.

### Communication Patterns

**Event System Patterns:** event names `domain.action` lowercase dotted (`booking.created`, `payment.confirmed`, `housekeeping.task.assigned`, `room.status.changed`). Payload `{ event, version, occurredAt, data }`. Events are persisted before broadcast so reconnecting clients can reconcile.

**State Management Patterns:** server state only via TanStack Query (no manual fetch-into-state); mutations are immutable and optimistic with rollback; local UI state in Zustand stores named `useXStore`. Offline mutations enqueue and replay in order on reconnect.

### Process Patterns

**Error Handling Patterns:** Nest global exception filter maps domain errors → the standard error envelope with a stable `code`. Web shows user-friendly messages from `error.code`; raw details only logged. Never leak stack traces to clients.

**Loading State Patterns:** TanStack Query `isPending`/`isError` drive skeletons; per-action button busy states; global offline/online banner (PWA). Status chips reuse the design-system semantic colors.

### Enforcement Guidelines

**All AI Agents MUST:**
- Use the shared Zod schema for any payload that crosses the web↔api boundary — never hand-roll a parallel type.
- Route every money calculation through `packages/shared` money utilities; never use floats for currency.
- Write an `audit_log` entry for every money-affecting or sensitive (auth, settings, identity) action.
- Check server-side permissions with `@RequirePermission(...)` on every non-public endpoint.

**Pattern Enforcement:** ESLint + `tsc --strict` + Prisma lint in CI; PR review checklist references this section; violations are tracked as tech-debt stories.

### Pattern Examples

**Good:** `GET /api/v1/bookings?status=confirmed` → `{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 57 } }`; price stored as `amountCents: 350000, currency: "KES"` (= KES 3,500.00).

**Anti-Patterns:** `GET /getBookingsList`; `price: 3500.0` as a float; tables named `Booking` / `Users`; ad-hoc `{ success: true, msg: "..." }` responses; client-trusted permission checks.

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
sommycomfort/
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                   # Turborepo task graph
├── docker-compose.yml           # postgres, redis, minio, api, web (dev)
├── .github/workflows/ci.yml
├── .env.example
│
├── apps/
│   ├── web/                     # Next.js 16 PWA (App Router)
│   │   ├── next.config.ts        # + Serwist PWA wiring
│   │   ├── public/
│   │   │   ├── manifest.webmanifest
│   │   │   └── icons/            # PWA icons/splash (from DESIGN_SYSTEM.md)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── (guest)/      # public booking workspace
│   │   │   │   ├── (staff)/      # admin, frontdesk, operations, housekeeping, kitchen
│   │   │   │   └── api/health/route.ts
│   │   │   ├── features/        # by feature: bookings, rooms, housekeeping, ...
│   │   │   ├── components/ui/    # shadcn/ui primitives
│   │   │   ├── lib/              # api client, auth, query client, sw registration
│   │   │   ├── stores/           # Zustand stores
│   │   │   └── styles/globals.css
│   │   ├── e2e/                  # Playwright
│   │   └── tailwind.config.ts
│   │
│   └── api/                     # NestJS 11 REST + Socket.IO + BullMQ
│       ├── nest-cli.json
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── config/           # typed env, swagger, helmet, cors
│       │   ├── common/           # guards, pipes (zod), filters, interceptors, decorators
│       │   ├── modules/
│       │   │   ├── auth/         # login, refresh, password, RBAC guard
│       │   │   ├── guests/       # guests + guest documents
│       │   │   ├── rooms/        # rooms, room types, amenities, rate plans
│       │   │   ├── bookings/     # bookings, check-in/out, calendar
│       │   │   ├── payments/     # payments, M-Pesa Daraja, ledger, reconciliation
│       │   │   ├── housekeeping/ # tasks, checklists (gateway)
│       │   │   ├── maintenance/  # maintenance + assets + asset checks + damage
│       │   │   ├── inventory/    # products, suppliers, purchases, stock, stocktake
│       │   │   ├── restaurant/   # menu, orders, kitchen display (gateway)
│       │   │   ├── reporting/    # aggregates + PDF/CSV export (BullMQ)
│       │   │   ├── notifications/# email/SMS/WhatsApp/web-push (BullMQ)
│       │   │   └── audit/        # audit log writer + query
│       │   └── realtime/         # Socket.IO gateway base + channels
│       └── test/                 # Supertest integration + e2e
│
└── packages/
    ├── shared/                  # Zod schemas, shared types, money + date utils, env schema
    ├── db/                      # Prisma schema, migrations, generated client
    └── config/                  # eslint, tsconfig, tailwind presets
```

### Architectural Boundaries

**API Boundaries:** the web app talks to the api **only** through the typed REST client in `apps/web/src/lib/api` using shared Zod types; no direct DB access from the web. Public (guest) endpoints vs. authenticated (staff) endpoints are separated by route group + guard.

**Component Boundaries:** `components/ui` = design-system primitives (no business logic); `features/*` = feature logic + data hooks; cross-feature sharing goes through `packages/shared` or `lib`, never feature→feature imports.

**Service Boundaries:** each Nest module owns its tables and exposes a service; cross-module access goes through the other module's service (never another module's repository). The `audit`, `notifications`, and `realtime` modules are cross-cutting and injected.

**Data Boundaries:** only `packages/db` imports Prisma; apps consume the generated client. Money/date formatting lives only in `packages/shared`.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
- Guest booking (`PRD.md` §5 Guest PWA) → `apps/web/src/app/(guest)` + `modules/bookings`, `modules/guests`, `modules/rooms`, `modules/payments`.
- Admin (config + RBAC + audit) → `app/(staff)/admin` + `modules/auth`, `modules/rooms`, `modules/audit`.
- Front desk → `app/(staff)/frontdesk` + `modules/bookings`, `modules/payments`, `modules/guests`.
- Operations/Caretaker + Housekeeping → `app/(staff)/operations|housekeeping` + `modules/housekeeping`, `modules/maintenance`, realtime.
- Inventory → `modules/inventory`. Restaurant/Kitchen → `app/(staff)/kitchen` + `modules/restaurant` + realtime. Reporting → `modules/reporting`.

**Cross-Cutting Concerns:** Auth/RBAC → `modules/auth` + `common/guards`. Audit → `modules/audit`. Realtime → `realtime/` + per-module gateways. Notifications → `modules/notifications` + BullMQ. Offline/PWA → `apps/web` service worker + TanStack Query mutation queue.

### Integration Points

**Internal Communication:** web → REST/JSON over HTTPS; server → Socket.IO push for live updates; modules → in-process service calls + emitted domain events; background work → BullMQ.

**External Integrations:** M-Pesa Daraja (STK push + callback webhook → BullMQ); email (SMTP/Resend); SMS + WhatsApp providers; Web Push (VAPID); S3-compatible storage (signed URLs).

**Data Flow:** request → Zod validation → permission guard → service → Prisma → Postgres; money/sensitive mutations → audit log + (optional) domain event → realtime/notifications.

### File Organization Patterns

**Configuration Files:** shared presets in `packages/config`; per-app config in the app root; env validated by `packages/shared/env`. **Source Organization:** domain modules (api) / features (web) as above. **Test Organization:** co-located `*.spec.ts` unit, `test/` + `e2e/` for integration/e2e. **Asset Organization:** PWA icons/manifest in `apps/web/public`; uploaded media in S3 (never in the repo).

### Development Workflow Integration

**Development Server Structure:** `pnpm dev` (Turborepo) runs web + api with shared watch; `docker-compose up` provides postgres/redis/minio. **Build Process Structure:** Turborepo builds `packages/*` first, then apps, with remote-cacheable tasks. **Deployment Structure:** per-app Docker images; migrate-then-deploy on release; web behind CDN, api behind the platform load balancer.

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All choices are mutually compatible and current as of June 2026 — Next.js 16.2 + React 19, NestJS 11.1 (deliberately **not** the unreleased v12 ESM line), PostgreSQL 18.4, Prisma 7.4, Tailwind v4, Node 24 LTS. TypeScript-everywhere with shared Zod schemas keeps web/api contracts coherent.

**Pattern Consistency:** Naming/format/event/error patterns align with the stack (Prisma `@@map` reconciles snake_case DB ↔ camelCase TS; Zod pipe enforces the envelope; Socket.IO event names match the domain modules).

**Structure Alignment:** The monorepo structure directly realizes the decisions — `packages/db` owns Prisma, `packages/shared` owns contracts/money, domain modules own their tables, web features map to role workspaces.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:** Every PRD surface (Guest, Admin, Front Desk, Operations/Caretaker, Housekeeping, Inventory, Restaurant, Reporting) maps to a concrete module + web workspace (see mapping above).

**Functional Requirements Coverage:** All §5 scope items have an owning module. ~28 §8 entities map to Prisma models across `guests`, `rooms`, `bookings`, `payments`, `housekeeping`, `maintenance`, `inventory`, `restaurant`, `audit`.

**Non-Functional Requirements Coverage:** PWA/offline/push → Serwist + TanStack Query queue + Web Push; realtime < 5 s → Socket.IO; RBAC → permissions guard; identity security → encrypted columns + signed URLs + audit; exports → BullMQ PDF/CSV; performance → CDN + Redis caching + Turbopack; Lighthouse ≥ 90 → PWA config target.

### Implementation Readiness Validation ✅

**Decision Completeness:** Critical decisions documented with verified versions. **Structure Completeness:** Concrete tree with all apps/packages/modules. **Pattern Completeness:** Naming, format, event, error, and loading patterns all specified with examples and enforcement.

### Gap Analysis Results

- **Important:** detailed Prisma schema (field-level) is not yet written — it is the next concrete deliverable, driven by `PRD.md` §8. (Owned by the first data-model story.)
- **Important:** offline-sync **conflict-resolution policy** (last-write-wins vs. per-field merge for housekeeping/asset updates) needs an explicit rule before the housekeeping module is built.
- **Important:** M-Pesa Daraja credentials/sandbox flow + reconciliation rules need a short integration spec.
- **Nice-to-have:** choose concrete SMS/WhatsApp providers; decide reporting aggregation approach (on-the-fly vs. materialized).

### Validation Issues Addressed

No **critical** (blocking) issues. The important gaps above are scoped as early implementation stories rather than architecture blockers — the stack and structure fully support them.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS — all 16 checklist items are confirmed and no Critical Gaps remain, but three Important gaps (field-level schema, offline conflict policy, M-Pesa integration spec) should be closed in the first stories.

**Confidence Level:** High — verified current versions, coherent TypeScript-everywhere stack, complete structure, and full PRD coverage.

**Key Strengths:** shared-contract monorepo eliminates web/api drift; exact-money + audit-first design fits a payments product; offline/realtime/RBAC are first-class, matching the hardest NFRs.

**Areas for Future Enhancement:** materialized reporting views; multi-property hierarchy; OTA/channel-manager and loyalty (all post-MVP per `PRD.md` §12).

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across all components.
- Respect project structure and boundaries (only `packages/db` touches Prisma; only `packages/shared` formats money/dates; every cross-boundary payload uses a shared Zod schema).
- Refer to this document for all architectural questions.

**First Implementation Priority:**
```bash
pnpm dlx create-turbo@latest sommycomfort --package-manager pnpm
# then add apps/web (Next.js 16) and apps/api (NestJS 11) and packages/{shared,db,config}
```
Immediately followed by the Prisma schema for the core entities (`PRD.md` §8) and the auth + RBAC module.

---

_Architecture workflow complete (BMAD `create-architecture`). This document is the single source of truth for Fammy Comforts's technical decisions._
