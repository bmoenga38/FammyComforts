import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/**
 * Housekeeping task functions (R1 surface over the Epic-6 task records; the
 * full R2 workspace adds assignment/checklists/photos). Tasks are created by
 * checkout (deskBookings.checkOut); assistants work them here with explicit
 * Start / Done / Reopen transitions (prototype V.tasks — no tap-row-to-cycle).
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Housekeeping", "read");
    const tasks = await ctx.db
      .query("housekeepingTasks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
    const out = [];
    for (const t of tasks) {
      const room = await ctx.db.get(t.roomId);
      out.push({
        taskId: t._id,
        roomNumber: room?.number ?? "?",
        status: t.status,
        priority: t.priority,
        notes: t.notes ?? null,
        at: t._creationTime,
      });
    }
    return out;
  },
});

/** Explicit transitions: pending → in_progress → completed, reopen → pending. */
export const setStatus = mutation({
  args: {
    taskId: v.id("housekeepingTasks"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, { taskId, status }) => {
    const { user, orgId } = await requirePermission(ctx, "Housekeeping", "write");
    const task = await ctx.db.get(taskId);
    if (!task || task.orgId !== orgId) {
      throw new Error("Task not found in this organization.");
    }
    if (task.status === status) return { changed: false };
    await ctx.db.patch(taskId, { status });
    // Completing a clean flips the room back to available.
    if (status === "completed") {
      const room = await ctx.db.get(task.roomId);
      if (room && (room.status === "dirty" || room.status === "cleaning")) {
        await ctx.db.patch(task.roomId, { status: "available" });
      }
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "housekeeping.set_status",
      entityType: "housekeepingTask",
      entityId: taskId,
      before: { status: task.status },
      after: { status },
    });
    return { changed: true };
  },
});
