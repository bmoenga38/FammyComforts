import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./lib/auth";

/**
 * Audit-log write/read helpers.
 *
 * ── SECURITY NOTE ────────────────────────────────────────────────────────────
 * Both exports here predate Convex Auth (Epic 2) and were originally unauthed:
 * `record` was a public `mutation` that inserted whatever it was given, so any
 * client holding the deployment URL could forge audit entries or write unbounded
 * rows, and `listForEntity` returned any org's history for any entity id.
 *
 * Nothing calls either one — every real audit row is written inline by the
 * mutation that made the change (`ctx.db.insert("auditLogs", …)`, ~85 sites), so
 * `record` is now `internalMutation` (reachable only from other Convex functions)
 * and `listForEntity` is permission-gated and org-scoped like `audit.list`.
 * Do NOT widen `record` back to `mutation`: an audit trail a client can write to
 * is not an audit trail.
 */
export const record = internalMutation({
  args: {
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    ip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLogs", args);
  },
});

/**
 * The most recent audit entries for one entity (reactive — re-runs on change).
 *
 * The `by_entity` index is not org-scoped, so the caller's `orgId` is applied as
 * a filter afterwards: an id from another tenant returns nothing rather than that
 * tenant's history.
 */
export const listForEntity = query({
  args: { entityType: v.string(), entityId: v.string() },
  handler: async (ctx, { entityType, entityId }) => {
    const { orgId } = await requirePermission(ctx, "Audit logs", "read");
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", entityType).eq("entityId", entityId),
      )
      .order("desc")
      .take(50);
    return rows.filter((r) => r.orgId === orgId);
  },
});
