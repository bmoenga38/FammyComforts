import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser, requirePermission } from "./lib/auth";

/**
 * Rooms (Story 3.3) — real bookable units, per-org, "Rooms" area. Each room
 * belongs to a branch + room type (both validated in-org); `number` is unique
 * per branch. `status` is the RoomStatus enum; it seeds the catalog/calendar.
 */
const STATUS = v.union(
  v.literal("available"),
  v.literal("occupied"),
  v.literal("dirty"),
  v.literal("cleaning"),
  v.literal("maintenance"),
  v.literal("blocked"),
);

export const list = query({
  args: { branchId: v.optional(v.id("branches")) },
  handler: async (ctx, { branchId }) => {
    const { orgId } = await requireOrgUser(ctx);
    const rooms = branchId
      ? (
          await ctx.db
            .query("rooms")
            .withIndex("by_branch", (q) => q.eq("branchId", branchId))
            .collect()
        ).filter((r) => r.orgId === orgId)
      : await ctx.db
          .query("rooms")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect();
    return Promise.all(
      rooms.map(async (r) => {
        const type = await ctx.db.get(r.roomTypeId);
        const branch = await ctx.db.get(r.branchId);
        return {
          ...r,
          roomTypeName: type?.name ?? null,
          branchName: branch?.name ?? null,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    branchId: v.id("branches"),
    roomTypeId: v.id("roomTypes"),
    number: v.string(),
    floor: v.optional(v.string()),
    status: v.optional(STATUS),
  },
  handler: async (ctx, { branchId, roomTypeId, number, floor, status }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const branch = await ctx.db.get(branchId);
    if (!branch || branch.orgId !== orgId) {
      throw new Error("Branch not found in this organization.");
    }
    const type = await ctx.db.get(roomTypeId);
    if (!type || type.orgId !== orgId) {
      throw new Error("Room type not found in this organization.");
    }
    // Unique number per branch (in-mutation index read).
    const clash = await ctx.db
      .query("rooms")
      .withIndex("by_branch_number", (q) =>
        q.eq("branchId", branchId).eq("number", number),
      )
      .unique();
    if (clash) throw new Error(`Room ${number} already exists in this branch.`);

    const roomId = await ctx.db.insert("rooms", {
      orgId,
      branchId,
      roomTypeId,
      number,
      floor,
      status: status ?? "available",
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "room.create",
      entityType: "room",
      entityId: roomId,
      after: { number, branchId, roomTypeId, status: status ?? "available" },
    });
    return roomId;
  },
});

export const update = mutation({
  args: {
    roomId: v.id("rooms"),
    number: v.optional(v.string()),
    floor: v.optional(v.string()),
    roomTypeId: v.optional(v.id("roomTypes")),
  },
  handler: async (ctx, { roomId, ...patch }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const room = await ctx.db.get(roomId);
    if (!room || room.orgId !== orgId) {
      throw new Error("Room not found in this organization.");
    }
    if (patch.roomTypeId) {
      const type = await ctx.db.get(patch.roomTypeId);
      if (!type || type.orgId !== orgId) {
        throw new Error("Room type not found in this organization.");
      }
    }
    if (patch.number && patch.number !== room.number) {
      const clash = await ctx.db
        .query("rooms")
        .withIndex("by_branch_number", (q) =>
          q.eq("branchId", room.branchId).eq("number", patch.number!),
        )
        .unique();
      if (clash) throw new Error(`Room ${patch.number} already exists in this branch.`);
    }
    await ctx.db.patch(roomId, patch);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "room.update",
      entityType: "room",
      entityId: roomId,
      after: patch,
    });
    return { changed: true };
  },
});

/** Change a room's status (catalog/calendar/housekeeping use this). */
export const setStatus = mutation({
  args: { roomId: v.id("rooms"), status: STATUS },
  handler: async (ctx, { roomId, status }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const room = await ctx.db.get(roomId);
    if (!room || room.orgId !== orgId) {
      throw new Error("Room not found in this organization.");
    }
    if (room.status === status) return { changed: false };
    await ctx.db.patch(roomId, { status });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "room.set_status",
      entityType: "room",
      entityId: roomId,
      before: { status: room.status },
      after: { status },
    });
    return { changed: true };
  },
});

export const remove = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const { user, orgId } = await requirePermission(ctx, "Rooms", "manage");
    const room = await ctx.db.get(roomId);
    if (!room || room.orgId !== orgId) {
      throw new Error("Room not found in this organization.");
    }
    await ctx.db.delete(roomId);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "room.remove",
      entityType: "room",
      entityId: roomId,
      before: { number: room.number },
    });
    return { changed: true };
  },
});
