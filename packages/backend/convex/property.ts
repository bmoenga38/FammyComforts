import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser, requirePermission } from "./lib/auth";

/**
 * Property settings (Story 3.1) — org-scoped, gated by the "Settings" area.
 * Reads need `Settings:read`; writes need `Settings:manage` and are audited.
 * Guest-facing screens read the property for check-in/out times + ID policy.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM" 24h

function assertTime(label: string, value: string): string {
  if (!TIME_RE.test(value)) {
    throw new Error(`${label} must be "HH:MM" (24h), got "${value}".`);
  }
  return value;
}

/** The caller's org properties. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("properties")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    checkInTime: v.string(),
    checkOutTime: v.string(),
    cancellationNote: v.optional(v.string()),
    idRequired: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    assertTime("checkInTime", args.checkInTime);
    assertTime("checkOutTime", args.checkOutTime);

    const propertyId = await ctx.db.insert("properties", { orgId, ...args });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "property.create",
      entityType: "property",
      entityId: propertyId,
      after: args,
    });
    return propertyId;
  },
});

export const update = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.optional(v.string()),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    cancellationNote: v.optional(v.string()),
    idRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, { propertyId, ...patch }) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    const property = await ctx.db.get(propertyId);
    if (!property || property.orgId !== orgId) {
      throw new Error("Property not found in this organization.");
    }
    if (patch.checkInTime !== undefined) assertTime("checkInTime", patch.checkInTime);
    if (patch.checkOutTime !== undefined)
      assertTime("checkOutTime", patch.checkOutTime);

    const before = {
      name: property.name,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      cancellationNote: property.cancellationNote,
      idRequired: property.idRequired,
    };
    await ctx.db.patch(propertyId, patch);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "property.update",
      entityType: "property",
      entityId: propertyId,
      before,
      after: patch,
    });
    return { changed: true };
  },
});
