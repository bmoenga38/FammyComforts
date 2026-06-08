---
baseline_commit: 088c4c7af8d3ecab31f1e523e51c546a4ac3e5ed
---

# Story 2.4: Staff management

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to create, edit, deactivate/reactivate, and assign roles to staff,
so that my team's access reflects reality.

> **Scope (admin staff CRUD over the Convex `users` table).** This story builds the **staff-management domain** on Convex: queries/mutations to list, view, create, edit, deactivate/reactivate staff and to assign/revoke their roles, all **admin-gated** via `requirePermission(ctx, "staff", …)` (AR6′), with every state change writing an `auditLogs` row (AR9, FR17). It also wires a deactivation **login block** so a deactivated user is denied access. The web side is the **Admin → Staff** screen under the `(app)/admin` workspace shell from Story 1.7.
>
> **Depends on Stories 2.1 + 2.3** (Convex Auth + the `users` table, and the `roles`/`permissions`/`rolePermissions`/`userRoles` tables + the `requirePermission` helper). Those tables/helpers do **not** exist on disk yet (Epic 2 is all `backlog`); the schema/helper deltas this story relies on are listed in Dev Notes as **assumed-from-2.1/2.3** so this story stays self-contained if it lands first or alongside them.

## Acceptance Criteria

Reframed for Convex per the Convex Implementation Guide (Convex Auth not JWT; `query`/`mutation` functions not REST controllers; in-function `requirePermission` not a Nest guard; reactive `useQuery` not polling). Derived from epics.md Story 2.4 (FR14, FR17).

1. **List + view staff (admin-gated, reactive)** — a `users.listStaff` query returns all staff (id, email, fullName, phone, isActive, assigned role ids/names), and `users.getStaff` returns one staff member with their roles. Both call `requirePermission(ctx, "staff", "read")` as their first line and throw `UNAUTHENTICATED` / `FORBIDDEN: staff:read` for callers without it. The Admin → Staff screen renders the list via `useQuery` (re-renders on any change, no polling). (FR14, AR6′)

2. **Create staff** — a `users.createStaff` mutation, gated by `requirePermission(ctx, "staff", "manage")`, validates args with `v.*` (email, fullName, optional phone, `roleIds: v.array(v.id("roles"))`), creates the auth `users` row (via the Convex Auth account-creation path, password set/invite per 2.1) with `isActive: true`, inserts the requested `userRoles` rows, and writes one `auditLogs` row (`action: "staff.create"`, `entityType: "user"`, `after` = the created profile). Duplicate email is rejected in-mutation by an index read (Convex has no unique constraint). (FR14, FR17)

3. **Edit staff profile** — a `users.updateStaff` mutation (`requirePermission(ctx, "staff", "manage")`) updates editable profile fields (fullName, phone; email change guarded by the same duplicate-email check) and writes an `auditLogs` row capturing `before`/`after`. It does **not** silently change roles (role changes are AC#5) and does **not** alter `isActive` (that is AC#4). (FR14, FR17)

4. **Deactivate / reactivate** — a `users.setStaffActive` mutation (`requirePermission(ctx, "staff", "manage")`) sets `isActive` to `false`/`true` and writes an `auditLogs` row (`action: "staff.deactivate"` / `"staff.reactivate"`, before/after). An admin **cannot deactivate their own account** (guard against `getAuthUserId(ctx) === targetId`) — throws a clear error. (FR14, FR17)

5. **Assign / revoke roles** — a `users.setStaffRoles` mutation (`requirePermission(ctx, "staff", "manage")`) replaces a user's `userRoles` to the supplied `roleIds: v.array(v.id("roles"))` (insert missing, delete removed; idempotent), validates every `roleId` exists, and writes an `auditLogs` row with before/after role sets. A user may hold **one or more** roles. (FR14, FR17)

6. **Deactivated user is denied access** — authentication/session establishment checks `isActive`: a deactivated user is denied (cannot sign in, and any existing session is rejected on the next authed call). Concretely, the shared auth path (the `requirePermission` helper and/or the session resolver from 2.1) treats `isActive === false` as `UNAUTHENTICATED`, so a deactivated user cannot reach any gated function. (epics.md 2.4 AC2)

7. **UI permission gating + tests green** — the Admin → Staff screen only renders staff-management controls when the signed-in user holds `staff:manage` (mirror the server permission for UX only; the server stays authoritative — a forbidden call still throws). `convex-test` covers: each function's RBAC allow/deny via `t.withIdentity(...)`, create/edit/deactivate/role-assign happy paths + the self-deactivation guard + duplicate-email guard + the audit-row-per-mutation invariant; web tests cover list render + manage-gating. All gates (`pnpm typecheck/lint/test`, and `pnpm build` for web) stay green. (NFR6)

## Tasks / Subtasks

- [ ] **Task 1: Schema deltas for staff fields** (AC: #1–#6) — in `packages/backend/convex/schema.ts`, ensure the auth `users` row carries the app profile fields from data-model.md `User` (`fullName: v.string()`, `phone: v.optional(v.string())`, `isActive: v.boolean()`; `email` comes from `authTables`). Add `.index("by_email", ["email"])` for the duplicate-email check and `.index("by_active", ["isActive"])` if useful for the list. Confirm `userRoles` has `.index("by_user", ["userId"])` and `.index("by_role", ["roleId"])` (from 2.3). **If 2.1/2.3 have not landed**, add the `users`/`roles`/`permissions`/`rolePermissions`/`userRoles` tables per the Convex Guide "Auth & RBAC §2" — see Dev Notes (do not duplicate if they already exist).
- [ ] **Task 2: `users.ts` domain functions** (AC: #1–#5) — create `packages/backend/convex/users.ts`:
  - [ ] `listStaff` (`query`) — `requirePermission(ctx, "staff", "read")`; collect users, resolve each user's role ids/names via `userRoles` `by_user` index. Declare `args: {}` and a `returns` validator.
  - [ ] `getStaff` (`query`) — `args: { userId: v.id("users") }`, `requirePermission(…, "staff", "read")`; returns profile + roles or `null`.
  - [ ] `createStaff` (`mutation`) — `args: { email, fullName, phone?, roleIds: v.array(v.id("roles")) }`, `requirePermission(…, "staff", "manage")`; duplicate-email guard via `by_email`; create auth user (Convex Auth path from 2.1); insert `userRoles`; `auditLogs` row.
  - [ ] `updateStaff` (`mutation`) — `args: { userId, fullName?, phone?, email? }`; profile-only; before/after audit.
  - [ ] `setStaffActive` (`mutation`) — `args: { userId, isActive: v.boolean() }`; self-deactivation guard; audit.
  - [ ] `setStaffRoles` (`mutation`) — `args: { userId, roleIds: v.array(v.id("roles")) }`; validate role existence; diff-and-apply `userRoles`; before/after audit.
- [ ] **Task 3: Audit + actor derivation** (AC: #2–#5) — write each `auditLogs` row **inside** the same mutation transaction (AR9). Set `actorId` from `getAuthUserId(ctx)` (the actor is derived from `ctx.auth`, never a client arg) — see Dev Notes on the `auditLogs.actorId` `v.string()`→`v.id("users")` migration. Reuse the existing `auditLogs.record` shape/fields; either call the internal insert directly or factor a small `lib/audit.ts` helper.
- [ ] **Task 4: Deactivation login block** (AC: #6) — in the shared auth path (the `requirePermission` helper in `convex/lib/auth.ts` and/or the 2.1 session resolver), after resolving `getAuthUserId(ctx)`, load the user and treat `isActive === false` as `UNAUTHENTICATED`. If 2.1's sign-in callback exposes a profile hook, also reject inactive users at sign-in. Keep the check in **one** place so every gated function inherits it.
- [ ] **Task 5: Web — Admin → Staff screen** (AC: #1, #7) — under `apps/web/src/app/(app)/admin/` add a staff page (or section) that lists staff via `useQuery(api.users.listStaff, {})`, with create/edit/deactivate/role-assign controls wired to `useMutation`. Render `undefined` as loading (skeleton, never as empty). Gate the manage controls on the signed-in user's `staff:manage` permission (a client-side permission read mirrored from the server — UX only). Reuse `Button`/`EmptyState`/form primitives from `@/components/ui` (Stories 1.3/1.4) and the shell from 1.7.
- [ ] **Task 6: Tests** (AC: #7) — `packages/backend/convex/users.test.ts` (convex-test, `edge-runtime`): RBAC allow/deny per function via `t.withIdentity(...)`; create/edit/deactivate/role-assign happy paths; self-deactivation guard; duplicate-email guard; one `auditLogs` row per mutation. Web: a `*.test.tsx` for the Staff screen (list renders from a mocked `useQuery`; manage controls hidden without `staff:manage`). Mock Convex hooks per the project's existing web test pattern.
- [ ] **Task 7: Verify gates** — run `pnpm typecheck`, `pnpm lint`, `pnpm test` (incl. the new backend config from the testing guide if not yet present), and `pnpm build` for web. All green. (Note the codegen caveat in Dev Notes — backend typecheck/test require `convex codegen` first.)

## Dev Notes

### Convex specifics (tables, functions, validators, RBAC)

- **Tables touched:** `users` (auth table from `authTables`, extended with `fullName`/`phone`/`isActive`), `userRoles` (join: `userId: v.id("users")`, `roleId: v.id("roles")`), `roles` (for name resolution + existence validation), and `auditLogs` (existing, AR9). Relations are `v.id(...)` + index, never FKs (AR4′).
- **Functions (all in `packages/backend/convex/users.ts`):** `listStaff` / `getStaff` (`query`), `createStaff` / `updateStaff` / `setStaffActive` / `setStaffRoles` (`mutation`). All **public** (called by the Admin client). Every one declares `args` with `convex/values` validators (and `returns` where useful) — the validators are the authoritative server contract; the web mirrors them for UX only and is never trusted.
- **RBAC (AR6′):** first line of every function is `await requirePermission(ctx, "staff", action)` — `"read"` for the queries, `"manage"` for the mutations. `"staff"` is one of the 18 permission areas; confirm the exact area string against the 2.3 permission seed (PRD §RBAC). The helper does N+1 `ctx.db.get`s per permission (acceptable at MVP role counts).
- **Validators:** `email: v.string()`, `fullName: v.string()`, `phone: v.optional(v.string())`, `isActive: v.boolean()`, `userId: v.id("users")`, `roleIds: v.array(v.id("roles"))`. No money in this story.
- **Uniqueness (no DB constraint):** email uniqueness is enforced **in-mutation** by reading the `by_email` index before insert/email-change and throwing on conflict (Convex has no unique constraint — Guide "Auth & RBAC" + "M-Pesa" gotchas).
- **Idempotent role apply:** `setStaffRoles` diffs the current `userRoles` (`by_user`) against `roleIds` and inserts/deletes only the delta, so a replay is a no-op.
- **Audit actor:** `auditLogs.actorId` is currently `v.optional(v.string())` in the scaffold; this story (or 2.1/2.3) migrates it to `v.optional(v.id("users"))` and sets it from `getAuthUserId(ctx)`. If 2.1/2.3 already migrated it, just consume it; otherwise migrate here and keep the audit write transactional with the change (AR9).
- **Self-deactivation guard (AC#4):** compare `getAuthUserId(ctx)` to the target `userId` and throw before mutating, so an admin can't lock themselves out.
- **Deactivation block (AC#6):** the single chokepoint is `requirePermission` (and the 2.1 session resolver). After getting `userId`, load the user; if `!user || user.isActive === false` → throw `UNAUTHENTICATED`. This makes deactivation effective on the next authed call without a session-revocation list.

### Honest right-scope: buildable-offline vs deferred

- **`convex dev` / `convex codegen` and live deploy require a Convex login that is unavailable in this dev environment.** As in prior Epic-1/2 stories, treat the following as **deferred to a Convex-authenticated session:** generating `convex/_generated/{api,server,dataModel}` (so `import { api }`, `internal`, `QueryCtx`/`MutationCtx`, and the web `api.users.*` imports resolve), running the convex-test suite end-to-end (it needs `_generated` first), and any `convex deploy` to `quixotic-boar-465`.
- **Buildable offline now:** the `users.ts` function source, the `schema.ts` deltas, the `lib/auth.ts`/`lib/audit.ts` helper edits, the web Staff screen + its tests, and the `users.test.ts` file — all written against the documented Convex 1.40.0 / Convex Auth APIs. They will typecheck/run only **after** `convex codegen` produces `_generated`; until then, treat backend typecheck/test as expected-to-defer and verify by code review against this spec + the Convex Guide. Web tests that mock the Convex hooks **can** run offline.
- **Also deferred (upstream deps):** if Stories 2.1 (Convex Auth + `users`) and 2.3 (`roles`/`permissions`/`requirePermission` + the permission seed) have not landed, their installs (`@convex-dev/auth @auth/core`) and codegen are prerequisites. Do not re-implement them here — consume them; only add the missing pieces guarded by "if not present" notes above. Record any such addition in the Completion Notes.

### Project Structure Notes

- **New:** `packages/backend/convex/users.ts` (+ `users.test.ts`); `apps/web/src/app/(app)/admin/staff/` page (or a `staff` section component under `admin/`) + its `*.test.tsx`; optionally `packages/backend/convex/lib/audit.ts`.
- **Modified:** `packages/backend/convex/schema.ts` (extend `users` with profile fields + indexes; add tables only if 2.1/2.3 didn't); `packages/backend/convex/lib/auth.ts` (deactivation block in `requirePermission`); `auditLogs.actorId` type migration if not already done.
- **Convention alignment:** one file per domain (`users.ts`), helpers in `convex/lib/`, tables `camelCase`, relations `<entity>Id` + index, internal vs public split (these are public — called by the Admin client). Web component filenames follow the repo's kebab-case convention with PascalCase exports (per 1.7). No changes to `apps/web` shell/root layout, `apps/api` (superseded), or unrelated packages.
- **Variance / dependency note:** Epic 2 is all `backlog`, so this story is authored to be resilient to ordering — it consumes 2.1/2.3 artifacts when present and adds the minimum guarded fallback when not. Do **not** edit `sprint-status.yaml` here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.4] — user story + ACs (create/edit/deactivate/assign-roles, audited; deactivated user denied login) (FR14, FR17).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1 / #Story-2.3] — upstream: Convex Auth identity + sessions (2.1), roles/18 permission areas + `requirePermission` enforcement + 403/UI-gating (2.3).
- [Source: _bmad-output/planning-artifacts/data-model.md#R1-Identity-Access] — `User` (email, fullName, phone, isActive), `Role`, `Permission`, `RolePermission`, `UserRole`; Convex mapping banner at top (Prisma→`defineTable`, FK→`v.id()`+index, enums→`v.union`).
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend-Platform-Addendum] — AR3′ (Convex functions, no REST), AR4′ (Convex doc DB, per-story tables, relations via Id+index), AR6′ (Convex Auth + in-function `requirePermission`), AR7′/AR8′.
- [Source: Convex Implementation Guide — "Auth & RBAC"] — `authTables`, `roles`/`permissions`/`rolePermissions`/`userRoles` schema, `getAuthUserId`, the `requirePermission(ctx, area, action)` helper, `manage`-vs-`read`/`write` discrete-row note, uniqueness-via-index gotcha.
- [Source: Convex Implementation Guide — "Testing (convex-test)"] — `convexTest(schema, modules)`, `t.withIdentity(...)` for RBAC tests, `edge-runtime` config scoped to `packages/backend`, `_generated` prerequisite.
- [Source: packages/backend/convex/schema.ts, auditLogs.ts] — existing `auditLogs` table/functions (AR9); `actorId` `v.string()`→`v.id("users")` migration note; per-story table convention.
- [Source: _bmad-output/implementation-artifacts/1-7-role-workspace-navigation-shell.md] — the `(app)/admin` workspace shell + `@/components/ui` primitives this screen plugs into; format/rigor exemplar.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
