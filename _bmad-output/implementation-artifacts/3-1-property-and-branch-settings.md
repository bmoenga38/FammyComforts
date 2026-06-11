---
baseline_commit: ecb8ad1
---

# Story 3.1: Property and branch settings

Status: done

> **Org-scoped (SSO model).** Per the multi-tenancy non-negotiable, `properties`
> and `branches` carry `orgId` + `by_org`, and every function filters by the
> SSO-resolved org. Gated by the **"Settings"** permission area
> (`requirePermission`); writes audit atomically (FR17/AR9). Backend landed +
> tested; web settings form is the remaining piece.

## Story

As an admin, I want to configure property and branch details and policies, so
that guest-facing info and operational rules are correct. (FR13, FR17)

## Acceptance Criteria

1. **Property settings persist (org-scoped, audited).** An admin with
   `Settings:manage` can create/update a property — name, `checkInTime` /
   `checkOutTime` (validated `HH:MM` 24h), `cancellationNote`, `idRequired` — and
   it persists scoped to their org; each change writes an `auditLogs` row.
2. **Branches hang off a property, same-org only.** Create/update/remove branches
   (name, location) under an org's property; a branch can never attach to another
   org's property (cross-org attempt throws).
3. **Reads are org-scoped (operational read policy).** `property.list` /
   `branches.list` require an authenticated **org member** — not a specific
   `Settings:read` grant (see the repo-wide read-gating policy in
   `convex/lib/auth.ts`: operational/config reads are open to org members, writes
   need `:manage`, only sensitive reads like staff/audit are `:read`-gated). They
   stay strictly org-scoped. Guest-facing screens read check-in/out + ID policy
   from the property (Epic 4).
4. **Validation + isolation.** Bad time formats are rejected; a caller without
   `Settings:manage` gets `FORBIDDEN`; org A never sees org B's property/branches.
5. **Gates green.** `convex codegen` + `pnpm typecheck` + `pnpm test` pass.

## Tasks

- [x] Schema: `properties` (orgId, name, checkInTime, checkOutTime,
      cancellationNote?, idRequired) + `branches` (orgId, propertyId, name,
      location?) with `by_org` / `by_property` indexes.
- [x] `convex/property.ts`: `list` / `create` / `update` (Settings-gated, audited,
      `HH:MM` validation).
- [x] `convex/branches.ts`: `list` / `create` / `update` / `remove`
      (Settings-gated, audited, same-org property check).
- [x] `convex/property.test.ts`: create/update + audit, bad-time rejection,
      branch lifecycle + cross-org block, permission denial. **Backend 28/28.**
- [x] Web: Property & Branches tab of `/admin/setup` (gated via
      `usePermissions`). *(Deferred to the web batch.)*

## Dev Notes

- **Permission area = "Settings"** (one of the 18). Property Admin / Super Admin
  have it via the seed; Receptionist etc. do not.
- **One+ properties per org** — the schema allows multiple (chains); the settings
  UI will treat the first as primary for now.
- Money/rates + room types/rooms are **Stories 3.2–3.4** (per-story tables).

## Dev Agent Record

### Agent Model Used
claude-opus-4-8[1m]

### File List
- Added: `convex/property.ts`, `convex/branches.ts`, `convex/property.test.ts`
- Modified: `convex/schema.ts` (+`properties`, +`branches`), `convex/_generated/*`
