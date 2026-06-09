import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/**
 * Audit log view (Story 2.5) — org-scoped, gated by `Audit logs:read`. Audit
 * rows are *written* throughout (auth, roles, staff, …); this is the read/filter
 * surface. Only the caller's org's rows are returned (the `by_org` index excludes
 * infra rows that carry no `orgId`, e.g. backups). Newest first.
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    // Optional filters: `action` is a prefix match (e.g. "staff." or "role.");
    // `entityType` is exact (e.g. "user", "role").
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, { limit, action, entityType }) => {
    const { orgId } = await requirePermission(ctx, "Audit logs", "read");
    const capped = Math.min(Math.max(limit ?? 100, 1), 500);

    let rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(capped);

    if (action) rows = rows.filter((r) => r.action.startsWith(action));
    if (entityType) rows = rows.filter((r) => r.entityType === entityType);
    return rows;
  },
});
