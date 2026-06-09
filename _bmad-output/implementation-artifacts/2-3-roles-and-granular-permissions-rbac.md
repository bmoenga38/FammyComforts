---
baseline_commit: 088c4c7af8d3ecab31f1e523e51c546a4ac3e5ed
---

# Story 2.3: Roles and granular permissions (RBAC)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to define roles with permissions across the 18 permission areas,
so that staff only access what they should.

> **Scope (RBAC foundation).** This story builds the **authorization layer** that every later epic gates on: the `roles` / `permissions` / `rolePermissions` / `userRoles` tables in `convex/schema.ts`, a seed of the **12 base roles × 18 permission areas × {read|write|manage}** model, the admin Convex functions to grant/revoke per-area permissions on a role, and the in-function **`requirePermission(ctx, area, action)`** helper (AR6′) that replaces the superseded NestJS `PermissionsGuard` + `@RequirePermission(...)` decorator. It also wires a `myPermissions` query the web reads to **hide/disable gated UI**, and the Roles admin surface in the existing `/admin` workspace shell (Story 1.7).
>
> **Depends on Story 2.1 (auth).** The `users` table and `getAuthUserId(ctx)` come from Convex Auth (`@convex-dev/auth`, `authTables`), which lands in **Story 2.1**. This story assumes `users` exists; if 2.1 is not yet merged, the `userId`-typed columns and `getAuthUserId` calls below are the integration seam. See Dev Notes → Right-scope.
>
> Out of scope: the auth/login flow itself (2.1), password reset (2.2), staff CRUD + role *assignment to a person* (2.4 — this story owns the `userRoles` *table + read path*, while the admin UI to attach roles to a staff member is 2.4), and the audit *view/filter* (2.5 — this story only *writes* `auditLogs` rows on role/permission mutations).

## Acceptance Criteria

1. **RBAC schema exists (Convex, AR4′).** `convex/schema.ts` defines `roles`, `permissions`, `rolePermissions`, and `userRoles` tables with `v.*` validators and the required indexes: `permissions` carries `area: v.string()` + `action: v.union(v.literal("read"), v.literal("write"), v.literal("manage"))` with `.index("by_area_action", ["area","action"])`; `roles` has `name`/`description` + `.index("by_name", ["name"])`; `rolePermissions` has `roleId: v.id("roles")` + `permissionId: v.id("permissions")` + `.index("by_role", ["roleId"])` (and `by_permission`); `userRoles` has `userId: v.id("users")` + `roleId: v.id("roles")` + `.index("by_user", ["userId"])` + `.index("by_role", ["roleId"])`. Relations are `v.id(...)` + index, **never** FKs. (data-model.md R1 Identity & Access; Convex guide §Auth&RBAC.2)

2. **The 12×18 model is seeded idempotently.** An internal seed mutation creates exactly the **18 permission areas** (Dashboard, Bookings, Guests, Rooms, Calendar, Housekeeping, Maintenance, Assets, Inventory, Purchases, Restaurant, Payments, Reports, Employees, Roles, Settings, Notifications, Audit logs) × **3 actions** (read/write/manage) = 54 `permissions` rows, and the **12 base roles** (Super Admin, Property Admin, Operations Manager, Receptionist, Housekeeping, Caretaker/Assistant, Maintenance, Restaurant Manager, Waiter, Chef/Kitchen, Accountant, Security) with sensible default `rolePermissions` grants. Re-running the seed is a **no-op** (guard on existing rows by index lookup — Convex has no unique constraint). (PRD §7; FR14)

3. **Server enforces permissions in-function (AR6′).** A shared `requirePermission(ctx, area, action)` helper in `convex/lib/auth.ts` resolves the caller via `getAuthUserId(ctx)`, walks `userRoles → rolePermissions → permissions`, and **returns the `userId` when granted** or **throws** `UNAUTHENTICATED` (no signed-in user) / `FORBIDDEN: <area>:<action>` (signed in, not granted). It is callable as the first line of any protected `query`/`mutation`. This is the binding replacement for `@RequirePermission('bookings:write')`. (FR14, NFR6, AR6′)

4. **Admin can grant/revoke per-area permissions on a role.** Mutations `roles.create`, `roles.rename`, `roles.setPermission` (grant/revoke one `area:action`), and queries `roles.list` / `roles.getWithPermissions` exist. Every mutation **first** calls `requirePermission(ctx, "Roles", "manage")`, performs the change in one transaction, and writes an `auditLogs` row (actor from `ctx.auth`, before/after) atomically (AR9). Grant is idempotent (no duplicate `rolePermissions` row); revoke is a no-op if absent.

5. **Negative path returns FORBIDDEN; UI gates off the same source.** A caller **without** the `Roles:manage` permission invoking any `roles.*` mutation gets a thrown `FORBIDDEN: Roles:manage` (the Convex-native equivalent of HTTP 403) and **no write occurs** (transaction rolls back). A `permissions.myPermissions` query returns the signed-in user's resolved `area:action` set; the web mirrors it to **hide/disable** gated elements (e.g. the Roles admin nav/actions), with the server remaining authoritative. (Story AC2 reframed for Convex)

6. **Web Roles admin surface + UI gating.** Within the existing `/admin` workspace shell (Story 1.7), a Roles management view lists roles and lets an authorized admin toggle the 18×3 permission grid for a role via `roles.setPermission` (reactive `useQuery` reflects changes). A `usePermissions()` hook (backed by `permissions.myPermissions`) drives client gating; unauthorized users do not see the Roles surface. The grid is keyboard-operable and labeled (UX-DR9 a11y floor carried from 1.7).

7. **Tested + green.** `convex-test` covers: the seed is idempotent (re-run → still 54 perms / 12 roles); `requirePermission` **grants** for a role that has the perm and **throws** `FORBIDDEN`/`UNAUTHENTICATED` on the negative/anonymous paths (driven via `t.withIdentity(...)`); `roles.setPermission` grant→revoke round-trips and writes an `auditLogs` row; and the **table-driven role × permission grid** authorization test required by Story 1.11 (epics.md "before Epic 2 RBAC") including negative cases. Web: a test asserting gated UI hides when `myPermissions` lacks `Roles:manage`. `pnpm build/typecheck/lint/test` stay green.

## Tasks / Subtasks

- [ ] **Task 1: Install Convex Auth prerequisite (shared with 2.1) (AC: #1, #3)**
  - [ ] If not already added by Story 2.1: `pnpm --filter @fammycomforts/backend add @convex-dev/auth @auth/core` (pin `@auth/core` to the version `@convex-dev/auth`'s README specifies), then `npx @convex-dev/auth` to generate `convex/auth.config.ts` + `SITE_URL`/`JWKS`/`JWT_PRIVATE_KEY` env. Verify the installed `convexAuth`/`getAuthUserId`/`authTables` signatures against `node_modules/.pnpm/@convex-dev+auth@*/` (APIs evolved across 0.0.x). [Convex guide §Auth&RBAC.1, Gotchas]
- [ ] **Task 2: RBAC schema (AC: #1)** — add `roles`, `permissions`, `rolePermissions`, `userRoles` to `convex/schema.ts` (alongside existing `auditLogs`), with the indexes in AC1. Spread `...authTables` (from 2.1) so `users` exists; extend the auth `users` row with app fields (`fullName`, `phone`, `isActive`) per data-model `User`. Flip `auditLogs.actorId` from `v.optional(v.string())` → `v.optional(v.id("users"))` now that `users` exists (and update `auditLogs.record` to derive actor from `ctx.auth`). [data-model.md R1; Convex guide §Auth&RBAC.2]
- [ ] **Task 3: `requirePermission` helper (AC: #3, #5)** — create `convex/lib/auth.ts` exporting `requirePermission(ctx, area, action)` (signature per the Convex guide): `getAuthUserId` → throw `UNAUTHENTICATED` if null → resolve `userRoles`(by_user) → `rolePermissions`(by_role) → `permissions` and return `userId` on match, else throw `FORBIDDEN: ${area}:${action}`. Type `ctx` as `QueryCtx | MutationCtx`. Add a typed `Area`/`Action` union in `packages/shared` (or `convex/lib/permissions.ts`) so areas/actions are not stringly-typed at call sites.
- [ ] **Task 4: Permission/role catalog + seed (AC: #2)** — `convex/lib/permissions.ts`: export the 18 `PERMISSION_AREAS` and 3 `ACTIONS` constants + the 12 `BASE_ROLES` with their default `area:action` grants. `convex/rbac.ts` (or `roles.ts`) `internalMutation seed`: idempotently upsert the 54 permissions (guard via `by_area_action`), 12 roles (guard via `by_name`), and default `rolePermissions` (guard via `by_role` + matching `permissionId`). Provide a way to run it (a thin public `seed` mutation gated by `Roles:manage`, or document `npx convex run rbac:seed`).
- [ ] **Task 5: Role admin functions (AC: #4, #5)** — `convex/roles.ts`:
  - [ ] `list` (query) — all roles; `getWithPermissions` (query) — one role + its resolved `area:action` grants.
  - [ ] `create` / `rename` (mutations) — `requirePermission(ctx,"Roles","manage")` first; enforce unique `name` via `by_name` lookup (no Convex unique constraint); audit row.
  - [ ] `setPermission` (mutation) — args `{ roleId, area, action, granted }`; idempotent grant (lookup before insert) / no-op revoke; audit before/after.
  - [ ] `permissions.myPermissions` (query) — resolve and return the signed-in caller's `area:action` set for UI gating.
- [ ] **Task 6: Web Roles admin + gating (AC: #5, #6)** — under `apps/web/src/app/(app)/admin/` add a Roles management view (server component shell + `"use client"` grid). `apps/web/src/lib/use-permissions.ts` (`usePermissions()` over `useQuery(api.permissions.myPermissions)`); a `<Can area action>` gate (or `hasPermission(perms, area, action)`) used to hide/disable the Roles surface + grid toggles. Wire the grid toggle to `useMutation(api.roles.setPermission)` (consider `withOptimisticUpdate` for the toggle). Confirm the `apps/web` → `packages/backend/convex/_generated/api` import path resolves. [Convex guide §Realtime; architecture.md Frontend]
- [ ] **Task 7: Tests (AC: #7)** — set up `packages/backend` Vitest per the Convex guide §Testing (deps `convex-test @edge-runtime/vm`, `test` script, `vitest.config.ts` with `environment: "edge-runtime"`, scoped to backend only). Add `convex/rbac.test.ts` (seed idempotency; `requirePermission` grant/forbidden/unauthenticated via `t.withIdentity`; `setPermission` round-trip + audit row) and the **table-driven role×permission grid** authorization test (1.11 gate). Add a web test (`use-permissions` / Roles gate hides without `Roles:manage`). Run all gates.

## Dev Notes

### Convex specifics (tables, functions, validators)
- **Tables (`convex/schema.ts`):** `roles { name: v.string(), description: v.optional(v.string()) }` `by_name`; `permissions { area: v.string(), action: v.union(v.literal("read"),v.literal("write"),v.literal("manage")) }` `by_area_action`; `rolePermissions { roleId: v.id("roles"), permissionId: v.id("permissions") }` `by_role` (+ `by_permission`); `userRoles { userId: v.id("users"), roleId: v.id("roles") }` `by_user` + `by_role`. Built-in `_id`/`_creationTime` replace Prisma `id`/`createdAt`. The Prisma `@@unique([area,action])` and `Role.name @unique` have **no native Convex equivalent** — enforce uniqueness by an index read **inside** the mutation in the same transaction (Convex guide gotcha). [data-model.md lines 62–98]
- **Functions:** public `query`/`mutation` for client-facing (`roles.list`, `roles.getWithPermissions`, `roles.create/rename/setPermission`, `permissions.myPermissions`); `internalMutation` for `rbac.seed`. Every state-changing mutation: `requirePermission(...)` first, then mutate, then write `auditLogs` in the **same** transaction (AR9, atomic). Declare `args` (and `returns` where useful) with `convex/values` validators — they are the authoritative server contract; the web mirrors them for UX only and is never trusted.
- **RBAC enforcement (AR6′):** `requirePermission(ctx, area, action)` is the single enforcement point — no decorators, no guard class. Actions (`action` ctx) have no `ctx.db`; not needed here, but if a future action needs a check it must `ctx.runQuery` a helper. **`manage` is a discrete row** in the current data-model — do **not** add `manage ⇒ read/write` implication logic unless the PRD says so (open item; keep discrete for now and encode default grants explicitly in the seed). [Convex guide §Auth&RBAC.3, Gotchas]
- **Validators:** areas/actions should be a TS union (`Area`/`Action`) shared between the helper, the seed catalog, and the web gate so call sites are typed, not stringly-typed.

### Right-scope — buildable-offline vs deferred
- **Convex login is unavailable in this dev environment.** `convex dev` / `convex codegen` / live deploy to `quixotic-boar-465` all require a Convex account login, which is not available here (same constraint as prior Epic-1/2 stories). Therefore:
  - **Buildable offline now:** author `schema.ts` table defs, `convex/lib/auth.ts`, `convex/lib/permissions.ts`, `convex/roles.ts`, `convex/rbac.ts`, the web view/hook/gate, and the `convex-test` test files. The code is reviewable and the logic testable in principle.
  - **Deferred to first `convex dev` (account required):** running `npx convex dev`/`codegen` to generate `convex/_generated/{api,server,dataModel}` — **until this runs, imports of `api`/`internal`/`QueryCtx`/`MutationCtx` do not resolve**, so backend typecheck and `convex-test` (which needs `_generated` + the `import.meta.glob`) **cannot pass locally** and must be excluded/skipped in CI until codegen runs. Installing `@convex-dev/auth` + `npx @convex-dev/auth` (env keys) and running `rbac.seed` against the live deployment are likewise deferred. Call this out in Completion Notes exactly as prior stories did.
  - **Coupling to Story 2.1:** `users` + `getAuthUserId` are owned by 2.1. If 2.1 has not merged, build against the documented seam (`v.id("users")` columns, `getAuthUserId(ctx)`) and flag the dependency; do not stub a parallel users table.

### Testing standards
- Backend: `convex-test` under Vitest `edge-runtime` (Convex guide §Testing) — **scoped to `packages/backend` only**; the workspace default `node` env breaks convex-test. Use `t.withIdentity({ subject })` to exercise `requirePermission` (authed-granted, authed-forbidden) and `getAuthUserId(null)` (anonymous) paths. The **table-driven role×permission grid** test (epics.md line 409, Story 1.11 gate "before Epic 2 RBAC") is mandatory and must include negative cases. Tests can only run once `_generated` exists (deferred above) — author them now; CI excludes until codegen.
- Web: Vitest + RTL (Story 1.11 harness), mock `convex/react` `useQuery` to return a permission set and assert the Roles surface hides/disables without `Roles:manage`.

### Project Structure Notes
- **New (backend):** `packages/backend/convex/lib/auth.ts`, `packages/backend/convex/lib/permissions.ts`, `packages/backend/convex/roles.ts`, `packages/backend/convex/rbac.ts` (seed), `packages/backend/convex/rbac.test.ts`; `packages/backend/vitest.config.ts` + `test` script in `packages/backend/package.json`. Possibly `convex/auth.ts` + `convex/auth.config.ts` if 2.1 has not created them.
- **Modified (backend):** `packages/backend/convex/schema.ts` (4 new tables + `...authTables` + `users` app fields + `auditLogs.actorId` → `v.id("users")`); `packages/backend/convex/auditLogs.ts` (actor from `ctx.auth`).
- **New (web):** Roles admin view under `apps/web/src/app/(app)/admin/` (+ `"use client"` grid component), `apps/web/src/lib/use-permissions.ts`, a `<Can>`/`hasPermission` gate, colocated `*.test.tsx`.
- **Naming:** Convex function files one-per-domain, `camelCase` tables/fields, `<entity>Id` relation fields + indexes (Convex guide §Conventions). Web follows the repo's kebab-case filename convention (per Story 1.7 note).
- **Variance:** AR6 (`@RequirePermission`/`PermissionsGuard`) is intentionally superseded by the in-function `requirePermission` helper per the Backend Platform Addendum (AR6′); the *permission model* (12×18×{read|write|manage}) is unchanged. Record this in Completion Notes.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.3] — story + AC (FR14, NFR6, AR6); epics.md line 409 — table-driven role×permission authorization test is a hard CI gate before Epic 2 RBAC (Story 1.11).
- [Source: PRD.md §7 (Roles and Permissions), lines 160–196] — the 12 base roles and 18 permission areas (authoritative list).
- [Source: _bmad-output/planning-artifacts/data-model.md#R1-Identity-Access, lines 45–126] — `User`/`Role`/`Permission`/`RolePermission`/`UserRole` shape + `@@unique` invariants; Convex mapping banner (lines 6–14).
- [Source: _bmad-output/planning-artifacts/architecture.md, lines 44, 53 (AR6′), 168, 187] — Convex Auth + in-function RBAC; permission model unchanged; `(staff)` route-group gating.
- [Source: Convex Implementation Guide — §Auth&RBAC (1 identity / 2 tables / 3 requirePermission helper + gotchas), §Testing (convex-test setup), §Realtime (useQuery gating)] — binding backend reference for this story.
- [Source: packages/backend/convex/{schema.ts,auditLogs.ts,health.ts}] — existing scaffold to build on (auditLogs table + record/listForEntity, conventions).
- [Source: _bmad-output/implementation-artifacts/1-7-role-workspace-navigation-shell.md] — `/admin` workspace shell the Roles surface mounts into; format exemplar.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
