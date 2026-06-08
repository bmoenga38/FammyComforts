import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Append an audit-log entry (AR9). Mutations are transactional. Once Convex Auth
 * lands (Epic 2), the actor is derived from `ctx.auth` rather than passed in.
 */
export const record = mutation({
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

/** The most recent audit entries for one entity (reactive — re-runs on change). */
export const listForEntity = query({
  args: { entityType: v.string(), entityId: v.string() },
  handler: async (ctx, { entityType, entityId }) => {
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", entityType).eq("entityId", entityId),
      )
      .order("desc")
      .take(50);
  },
});
