import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";

/**
 * Housekeeping workspace (Epic 7, Stories 7.3–7.5). Tasks are created at
 * checkout (deskBookings.checkOut) or manually here; ops managers
 * (Housekeeping:manage) assign and prioritize; housekeepers (write) execute
 * with start/pause/complete/flag, room-type checklists, and photo proof.
 *
 * Checklists are SNAPSHOTTED from `checklistTemplates` onto the task when work
 * starts (first transition to in_progress), so template edits never rewrite
 * in-flight tasks. Per-room-type template wins over the org default.
 */

export const list = query({
  args: { mine: v.optional(v.boolean()) },
  handler: async (ctx, { mine }) => {
    const { user, orgId } = await requirePermission(ctx, "Housekeeping", "read");
    const tasks = await ctx.db
      .query("housekeepingTasks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
    const out = [];
    for (const t of tasks) {
      if (mine && t.assigneeId !== user._id) continue;
      const room = await ctx.db.get(t.roomId);
      const assignee = t.assigneeId ? await ctx.db.get(t.assigneeId) : null;
      out.push({
        taskId: t._id,
        roomNumber: room?.number ?? "?",
        status: t.status,
        priority: t.priority,
        notes: t.notes ?? null,
        assigneeId: t.assigneeId ?? null,
        assigneeName: assignee?.name ?? null,
        checklist: t.checklist ?? null,
        photoUrl: t.photoStorageId
          ? await ctx.storage.getUrl(t.photoStorageId)
          : null,
        at: t._creationTime,
      });
    }
    return out;
  },
});

/** 7.3 — manual task creation (dirty room or ad-hoc need). */
export const create = mutation({
  args: {
    roomId: v.id("rooms"),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    notes: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, { roomId, priority, notes, assigneeId }) => {
    const { user, orgId } = await requirePermission(ctx, "Housekeeping", "write");
    const room = await ctx.db.get(roomId);
    if (!room || room.orgId !== orgId) {
      throw new Error("Room not found in this organization.");
    }
    if (assigneeId) {
      const assignee = await ctx.db.get(assigneeId);
      if (!assignee || assignee.orgId !== orgId) {
        throw new Error("Assignee not found in this organization.");
      }
    }
    const taskId = await ctx.db.insert("housekeepingTasks", {
      orgId,
      roomId,
      status: "pending",
      priority,
      notes,
      assigneeId,
    });
    if (assigneeId) await queueAssignmentNotice(ctx, orgId, room.number);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "housekeeping.create",
      entityType: "housekeepingTask",
      entityId: taskId,
      after: { roomId, priority, assigneeId: assigneeId ?? null },
    });
    return { taskId };
  },
});

/** 7.3 — assignment + priority (ops manager). Assignment notifies (FR56). */
export const assign = mutation({
  args: {
    taskId: v.id("housekeepingTasks"),
    assigneeId: v.optional(v.id("users")), // unset = unassign
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
  },
  handler: async (ctx, { taskId, assigneeId, priority }) => {
    const { user, orgId } = await requirePermission(ctx, "Housekeeping", "manage");
    const task = await ctx.db.get(taskId);
    if (!task || task.orgId !== orgId) {
      throw new Error("Task not found in this organization.");
    }
    if (assigneeId) {
      const assignee = await ctx.db.get(assigneeId);
      if (!assignee || assignee.orgId !== orgId) {
        throw new Error("Assignee not found in this organization.");
      }
    }
    await ctx.db.patch(taskId, {
      assigneeId,
      ...(priority ? { priority } : {}),
    });
    if (assigneeId && assigneeId !== task.assigneeId) {
      const room = await ctx.db.get(task.roomId);
      await queueAssignmentNotice(ctx, orgId, room?.number ?? "?");
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "housekeeping.assign",
      entityType: "housekeepingTask",
      entityId: taskId,
      before: { assigneeId: task.assigneeId ?? null, priority: task.priority },
      after: { assigneeId: assigneeId ?? null, priority: priority ?? task.priority },
    });
    return { changed: true };
  },
});

/** 7.4 — start/pause/complete/flag/reopen. Completing frees the room. */
export const setStatus = mutation({
  args: {
    taskId: v.id("housekeepingTasks"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("flagged"),
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

    // First start: snapshot the room-type checklist template onto the task.
    if (status === "in_progress" && !task.checklist) {
      const room = await ctx.db.get(task.roomId);
      const templates = await ctx.db
        .query("checklistTemplates")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      const tpl =
        templates.find((t) => room && t.roomTypeId === room.roomTypeId) ??
        templates.find((t) => !t.roomTypeId);
      if (tpl && tpl.items.length > 0) {
        await ctx.db.patch(taskId, {
          checklist: tpl.items.map((label) => ({ label, done: false })),
        });
      }
    }
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

/** 7.4 — tick/untick one checklist item by index. */
export const toggleChecklistItem = mutation({
  args: { taskId: v.id("housekeepingTasks"), index: v.number() },
  handler: async (ctx, { taskId, index }) => {
    const { orgId } = await requirePermission(ctx, "Housekeeping", "write");
    const task = await ctx.db.get(taskId);
    if (!task || task.orgId !== orgId) {
      throw new Error("Task not found in this organization.");
    }
    const checklist = task.checklist ?? [];
    if (index < 0 || index >= checklist.length) {
      throw new Error("No such checklist item.");
    }
    checklist[index] = { ...checklist[index], done: !checklist[index].done };
    await ctx.db.patch(taskId, { checklist });
    return { done: checklist[index].done };
  },
});

/** 7.5 — photo proof: client uploads to the signed URL, then links it here. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "Housekeeping", "write");
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachPhoto = mutation({
  args: { taskId: v.id("housekeepingTasks"), storageId: v.id("_storage") },
  handler: async (ctx, { taskId, storageId }) => {
    const { user, orgId } = await requirePermission(ctx, "Housekeeping", "write");
    const task = await ctx.db.get(taskId);
    if (!task || task.orgId !== orgId) {
      throw new Error("Task not found in this organization.");
    }
    await ctx.db.patch(taskId, { photoStorageId: storageId });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "housekeeping.attach_photo",
      entityType: "housekeepingTask",
      entityId: taskId,
    });
    return { ok: true };
  },
});

// ---------- 7.4: checklist templates ----------

export const getTemplates = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Housekeeping", "read");
    const templates = await ctx.db
      .query("checklistTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const out = [];
    for (const t of templates) {
      const roomType = t.roomTypeId ? await ctx.db.get(t.roomTypeId) : null;
      out.push({
        templateId: t._id,
        roomTypeId: t.roomTypeId ?? null,
        roomTypeName: roomType?.name ?? "All room types (default)",
        items: t.items,
      });
    }
    return out;
  },
});

/** Upsert the template for a room type (or the org default when unset). */
export const setTemplate = mutation({
  args: {
    roomTypeId: v.optional(v.id("roomTypes")),
    items: v.array(v.string()),
  },
  handler: async (ctx, { roomTypeId, items }) => {
    const { user, orgId } = await requirePermission(ctx, "Housekeeping", "manage");
    if (roomTypeId) {
      const rt = await ctx.db.get(roomTypeId);
      if (!rt || rt.orgId !== orgId) throw new Error("Room type not found.");
    }
    const existing = (
      await ctx.db
        .query("checklistTemplates")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).find((t) => (t.roomTypeId ?? null) === (roomTypeId ?? null));
    const clean = items.map((i) => i.trim()).filter(Boolean);
    if (existing) await ctx.db.patch(existing._id, { items: clean });
    else await ctx.db.insert("checklistTemplates", { orgId, roomTypeId, items: clean });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "housekeeping.set_template",
      entityType: "checklistTemplate",
      after: { roomTypeId: roomTypeId ?? null, items: clean },
    });
    return { ok: true };
  },
});

/** Staff the task can be assigned to (active org users), for the picker. */
export const assignees = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Housekeeping", "read");
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return users
      .filter((u) => u.isActive && u.role !== "customer")
      .map((u) => ({ userId: u._id, name: u.name, role: u.role }));
  },
});

/** Assignment notice into the queue → bell feed + SMS engine (FR56). */
async function queueAssignmentNotice(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  roomNumber: string,
) {
  await ctx.db.insert("outboundNotifications", {
    orgId,
    type: "task_assignment",
    channel: "push",
    status: "queued",
    body: `New cleaning task assigned — Room ${roomNumber}`,
  });
}
