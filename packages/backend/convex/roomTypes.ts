import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrgUser, requirePermission } from "./lib/auth";

/**
 * Room types (Story 3.2) — per-org, "Rooms" area. Capacity + size + a set of
 * amenities; rooms (3.3) and rate plans (3.4) reference a room type.
 */

/** Replace a room type's amenity set (validates each amenity is in-org). */
async function setAmenitySet(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  roomTypeId: Id<"roomTypes">,
  amenityIds: Id<"amenities">[],
): Promise<void> {
  const existing = await ctx.db
    .query("roomTypeAmenities")
    .withIndex("by_roomType", (q) => q.eq("roomTypeId", roomTypeId))
    .collect();
  for (const j of existing) await ctx.db.delete(j._id);
  for (const amenityId of amenityIds) {
    const amenity = await ctx.db.get(amenityId);
    if (!amenity || amenity.orgId !== orgId) {
      throw new Error("Amenity not found in this organization.");
    }
    await ctx.db.insert("roomTypeAmenities", { orgId, roomTypeId, amenityId });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    const types = await ctx.db
      .query("roomTypes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return Promise.all(
      types.map(async (t) => {
        const joins = await ctx.db
          .query("roomTypeAmenities")
          .withIndex("by_roomType", (q) => q.eq("roomTypeId", t._id))
          .collect();
        const amenities: string[] = [];
        for (const j of joins) {
          const a = await ctx.db.get(j.amenityId);
          if (a) amenities.push(a.name);
        }
        return { ...t, amenities: amenities.sort() };
      }),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    capacity: v.number(),
    sizeSqm: v.optional(v.number()),
    amenityIds: v.optional(v.array(v.id("amenities"))),
  },
  handler: async (ctx, { name, capacity, sizeSqm, amenityIds }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    if (capacity < 1) throw new Error("Capacity must be at least 1.");

    const roomTypeId = await ctx.db.insert("roomTypes", {
      orgId,
      name,
      capacity,
      sizeSqm,
    });
    if (amenityIds?.length) await setAmenitySet(ctx, orgId, roomTypeId, amenityIds);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "roomType.create",
      entityType: "roomType",
      entityId: roomTypeId,
      after: { name, capacity, sizeSqm },
    });
    return roomTypeId;
  },
});

export const update = mutation({
  args: {
    roomTypeId: v.id("roomTypes"),
    name: v.optional(v.string()),
    capacity: v.optional(v.number()),
    sizeSqm: v.optional(v.number()),
    amenityIds: v.optional(v.array(v.id("amenities"))),
  },
  handler: async (ctx, { roomTypeId, amenityIds, ...patch }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const type = await ctx.db.get(roomTypeId);
    if (!type || type.orgId !== orgId) {
      throw new Error("Room type not found in this organization.");
    }
    if (patch.capacity !== undefined && patch.capacity < 1) {
      throw new Error("Capacity must be at least 1.");
    }
    await ctx.db.patch(roomTypeId, patch);
    if (amenityIds) await setAmenitySet(ctx, orgId, roomTypeId, amenityIds);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "roomType.update",
      entityType: "roomType",
      entityId: roomTypeId,
      after: { ...patch, ...(amenityIds ? { amenityIds } : {}) },
    });
    return { changed: true };
  },
});

export const remove = mutation({
  args: { roomTypeId: v.id("roomTypes") },
  handler: async (ctx, { roomTypeId }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const type = await ctx.db.get(roomTypeId);
    if (!type || type.orgId !== orgId) {
      throw new Error("Room type not found in this organization.");
    }
    // Guard: don't orphan rooms that use this type.
    const inUse = await ctx.db
      .query("rooms")
      .withIndex("by_roomType", (q) => q.eq("roomTypeId", roomTypeId))
      .first();
    if (inUse) throw new Error("Cannot delete a room type that rooms still use.");

    const joins = await ctx.db
      .query("roomTypeAmenities")
      .withIndex("by_roomType", (q) => q.eq("roomTypeId", roomTypeId))
      .collect();
    for (const j of joins) await ctx.db.delete(j._id);
    await ctx.db.delete(roomTypeId);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "roomType.remove",
      entityType: "roomType",
      entityId: roomTypeId,
      before: { name: type.name },
    });
    return { changed: true };
  },
});
