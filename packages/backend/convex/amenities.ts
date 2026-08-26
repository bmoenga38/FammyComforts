import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser, requirePermission } from "./lib/auth";
import { userError } from "./lib/errors";

/**
 * Amenities catalog (Story 3.2) — per-org, "Rooms" area. Reusable tags assigned
 * to room types (e.g. Wi-Fi, AC, Balcony). Unique name per org.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("amenities")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const clash = await ctx.db
      .query("amenities")
      .withIndex("by_org_name", (q) => q.eq("orgId", orgId).eq("name", name))
      .unique();
    if (clash) userError(`Amenity "${name}" already exists.`);

    const amenityId = await ctx.db.insert("amenities", { orgId, name });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "amenity.create",
      entityType: "amenity",
      entityId: amenityId,
      after: { name },
    });
    return amenityId;
  },
});

export const remove = mutation({
  args: { amenityId: v.id("amenities") },
  handler: async (ctx, { amenityId }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const amenity = await ctx.db.get(amenityId);
    if (!amenity || amenity.orgId !== orgId) {
      userError("Amenity not found in this organization.");
    }
    // Detach from any room types first (keep joins consistent).
    const joins = await ctx.db
      .query("roomTypeAmenities")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const j of joins) {
      if (j.amenityId === amenityId) await ctx.db.delete(j._id);
    }
    await ctx.db.delete(amenityId);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "amenity.remove",
      entityType: "amenity",
      entityId: amenityId,
      // Frozen at delete time — the document is about to be unreachable, so
      // read-time resolution in `audit.list` could only ever show the raw id.
      entityLabel: amenity.name,
      before: { name: amenity.name },
    });
    return { changed: true };
  },
});
