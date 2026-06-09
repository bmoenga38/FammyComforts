import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Fammy Comforts Convex schema (AR4′ — see architecture.md Backend Platform Addendum).
 *
 * Tables are added **per-story when first needed** (the data-model.md entities are
 * the target, re-expressed as Convex tables). This scaffold defines only
 * `auditLogs` — the cross-cutting audit table (AR9) — to prove the wiring +
 * conventions. Identity / property / booking / payment tables land with their
 * owning stories (Epic 2+).
 *
 * Conventions:
 * - Built-in `_id: Id<"table">` + `_creationTime` replace the Prisma `id`/`createdAt`.
 * - Foreign keys are `v.id("otherTable")` + an `.index(...)` (no implicit FK indexes).
 * - Money: integer minor units via `v.int64()`; never floats.
 * - Enums: `v.union(v.literal(...), ...)` or a shared TS union in `packages/shared`.
 *
 * ⛔ MULTI-TENANCY NON-NEGOTIABLE (Epic 2 integration spec §2, from Story 2.1 on):
 *   Every tenant-scoped table carries `orgId: v.id("organizations")` and a
 *   `by_org*` index, and EVERY query/mutation filters by the SSO-resolved
 *   `orgId` (see `lib/auth.ts` → `requireOrgUser`). The only table exempt is
 *   `organizations` itself (it *is* the tenant root). Cross-cutting infra tables
 *   that are not per-tenant (`backupRuns`) are also exempt; `auditLogs` will gain
 *   `orgId` when auth wiring lands (kept optional now for the Story-1 scaffold).
 *   No new tenant table ships without `orgId` — backfilling it later is painful.
 */
export default defineSchema({
  // Convex Auth managed tables (`authSessions`, `authAccounts`,
  // `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`,
  // `authRateLimits`, and a default `users`). Our `users` definition below
  // overrides the auth default to carry the app + tenancy fields. Session
  // minting (the `sso-handoff` provider in `auth.ts`) reads/writes these.
  ...authTables,

  // ===== Identity & Access (Epic 2, Story 2.1) — SSO identity cache =====
  // FammyComfort does NOT own credentials; staff authenticate via the
  // Bytebazaar (ByteAuth) SSO handoff. These two tables are a local cache of
  // the org + user resolved from `verifyHandoff`, populated on first SSO and
  // refreshed on each subsequent one. `organizations` is the tenant root.

  organizations: defineTable({
    // The Bytebazaar org `_id` (string form) — the stable cross-platform key
    // we upsert against. Unique per org.
    bytebazaarOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  }).index("by_bytebazaar_org", ["bytebazaarOrgId"]),

  users: defineTable({
    // Tenant scope (the non-negotiable). Every user belongs to exactly one org.
    orgId: v.id("organizations"),
    // The Bytebazaar user `_id` (string form) — the SSO upsert key, unique.
    bytebazaarUserId: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    // Raw role string from the SSO payload. Granular RBAC (the tables below +
    // `requirePermission`) is Story 2.3 — this is the seed it refines.
    role: v.string(),
    // Server-authoritative active gate (Story 2.4 deactivate builds on this).
    isActive: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_bytebazaar_user", ["bytebazaarUserId"]),

  // ===== RBAC (Story 2.3) — 12 roles × 18 areas × {read|write|manage} =====
  // `permissions` is a GLOBAL catalog (the area:action definitions are the same
  // for every tenant). `roles`/`rolePermissions`/`userRoles` are PER-ORG (each
  // org gets its own seeded copy of the base roles + can customise), so they
  // carry `orgId` + a `by_org*` index per the non-negotiable. Enforcement is the
  // in-function `requirePermission(ctx, area, action)` helper (AR6′) — no FKs,
  // uniqueness enforced by index-read inside the mutation.

  permissions: defineTable({
    area: v.string(),
    action: v.union(
      v.literal("read"),
      v.literal("write"),
      v.literal("manage"),
    ),
  }).index("by_area_action", ["area", "action"]),

  roles: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    // System (seeded base) roles vs admin-created custom roles.
    isSystem: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "name"]),

  rolePermissions: defineTable({
    orgId: v.id("organizations"),
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  })
    .index("by_org", ["orgId"])
    .index("by_role", ["roleId"]),

  userRoles: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_role", ["roleId"]),
  auditLogs: defineTable({
    // Tenant scope (Story 2.3). Optional: Story-1 infra rows (backups) have no org.
    orgId: v.optional(v.id("organizations")),
    // actorId is the `users._id` string where known (kept as string so infra
    // rows without an actor stay valid; resolved from `ctx.auth`, never client).
    actorId: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    ip: v.optional(v.string()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor", ["actorId"])
    .index("by_org", ["orgId"]),

  // Backup/DR run ledger (Story 1.10, NFR12). A row is written from a mutation
  // for each scheduled `convex export`; the artifact blob lives in `_storage`
  // and `prune` deletes both the row and the blob beyond the retention window.
  backupRuns: defineTable({
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    storageId: v.optional(v.id("_storage")),
    sizeBytes: v.optional(v.int64()),
    error: v.optional(v.string()),
    trigger: v.union(v.literal("cron"), v.literal("manual")),
  })
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"]),
});
