import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser, requirePermission } from "./lib/auth";

/**
 * Notification settings (Story 3.5) — per-org, "Notifications" area. One row per
 * (type, channel); the notification engine (later epics) respects `enabled`.
 * Reads need an authenticated org user; `setEnabled` needs `Notifications:manage`.
 */
const CHANNEL = v.union(
  v.literal("email"),
  v.literal("sms"),
  v.literal("whatsapp"),
  v.literal("push"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("notificationSettings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

/** Enable/disable one (type, channel). Upserts the row; audited. */
export const setEnabled = mutation({
  args: { type: v.string(), channel: CHANNEL, enabled: v.boolean() },
  handler: async (ctx, { type, channel, enabled }) => {
    const { user, orgId } = await requirePermission(
      ctx,
      "Notifications",
      "manage",
    );
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_org_type_channel", (q) =>
        q.eq("orgId", orgId).eq("type", type).eq("channel", channel),
      )
      .unique();

    if (existing) {
      if (existing.enabled === enabled) return { changed: false };
      await ctx.db.patch(existing._id, { enabled });
    } else {
      await ctx.db.insert("notificationSettings", {
        orgId,
        type,
        channel,
        enabled,
      });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "notification.set_enabled",
      entityType: "notificationSetting",
      after: { type, channel, enabled },
    });
    return { changed: true };
  },
});
