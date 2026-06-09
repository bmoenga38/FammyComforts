import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
 */
export default defineSchema({
  auditLogs: defineTable({
    // → v.id("users") once the users table lands (Epic 2 / Convex Auth).
    actorId: v.optional(v.string()),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    ip: v.optional(v.string()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor", ["actorId"]),

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
