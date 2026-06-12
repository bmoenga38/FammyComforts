import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { postLedgerEntry } from "./lib/ledger";
import { raiseEscalation } from "./lib/escalate";

/**
 * Maintenance & damage reporting (Story 7.6, FR28). Caretakers report issues
 * with optional photo + notes; DAMAGE linked to a checked-in/out booking with
 * a charge posts a positive ledger adjustment (the guest owes it — Epic 5 sign
 * convention) and raises an escalation. Reporting maintenance on a room can
 * also flip it to "maintenance" so it leaves the bookable pool.
 */

export const report = mutation({
  args: {
    kind: v.union(v.literal("maintenance"), v.literal("damage")),
    description: v.string(),
    roomId: v.optional(v.id("rooms")),
    bookingId: v.optional(v.id("bookings")),
    chargeCents: v.optional(v.int64()),
    photoStorageId: v.optional(v.id("_storage")),
    blockRoom: v.optional(v.boolean()), // maintenance: take the room offline
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Maintenance", "write");
    if (!args.description.trim()) throw new Error("A description is required.");

    if (args.roomId) {
      const room = await ctx.db.get(args.roomId);
      if (!room || room.orgId !== orgId) throw new Error("Room not found.");
    }
    let booking = null;
    if (args.bookingId) {
      booking = await ctx.db.get(args.bookingId);
      if (!booking || booking.orgId !== orgId) throw new Error("Booking not found.");
    }
    if (args.chargeCents !== undefined) {
      if (args.kind !== "damage") throw new Error("Only damage carries a charge.");
      if (!booking) throw new Error("A damage charge needs a booking to bill.");
      if (args.chargeCents <= 0n) throw new Error("Damage charge must be positive.");
    }

    const issueId = await ctx.db.insert("maintenanceIssues", {
      orgId,
      roomId: args.roomId,
      bookingId: args.bookingId,
      kind: args.kind,
      description: args.description.trim(),
      status: "open",
      photoStorageId: args.photoStorageId,
      chargeCents: args.chargeCents,
      reportedBy: user._id,
    });

    if (booking && args.chargeCents) {
      await postLedgerEntry(ctx, {
        orgId,
        bookingId: booking._id,
        type: "adjustment",
        amountCents: args.chargeCents,
        currency: booking.currency,
        memo: `Damage: ${args.description.trim()}`,
      });
      await raiseEscalation(ctx, {
        orgId,
        trigger: "damaged_asset",
        message: `Damage charged to ${booking.reference}: ${args.description.trim()}`,
        entityType: "maintenanceIssue",
        entityId: issueId,
      });
    }
    if (args.kind === "maintenance" && args.roomId && args.blockRoom) {
      await ctx.db.patch(args.roomId, { status: "maintenance" });
    }

    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "maintenance.report",
      entityType: "maintenanceIssue",
      entityId: issueId,
      after: {
        kind: args.kind,
        roomId: args.roomId ?? null,
        bookingId: args.bookingId ?? null,
        chargeCents: args.chargeCents ?? null,
      },
    });
    return { issueId };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Maintenance", "read");
    const issues = await ctx.db
      .query("maintenanceIssues")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
    const out = [];
    for (const i of issues) {
      const room = i.roomId ? await ctx.db.get(i.roomId) : null;
      const reporter = await ctx.db.get(i.reportedBy);
      out.push({
        issueId: i._id,
        kind: i.kind,
        description: i.description,
        status: i.status,
        roomNumber: room?.number ?? null,
        chargeCents: i.chargeCents ?? null,
        photoUrl: i.photoStorageId ? await ctx.storage.getUrl(i.photoStorageId) : null,
        reportedBy: reporter?.name ?? "?",
        at: i._creationTime,
      });
    }
    return out;
  },
});

/** open → in_progress → resolved. Resolving a room-blocking issue frees it. */
export const setStatus = mutation({
  args: {
    issueId: v.id("maintenanceIssues"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
    ),
  },
  handler: async (ctx, { issueId, status }) => {
    const { user, orgId } = await requirePermission(ctx, "Maintenance", "write");
    const issue = await ctx.db.get(issueId);
    if (!issue || issue.orgId !== orgId) throw new Error("Issue not found.");
    if (issue.status === status) return { changed: false };
    await ctx.db.patch(issueId, { status });
    if (status === "resolved" && issue.roomId) {
      const room = await ctx.db.get(issue.roomId);
      if (room?.status === "maintenance") {
        await ctx.db.patch(issue.roomId, { status: "available" });
      }
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "maintenance.set_status",
      entityType: "maintenanceIssue",
      entityId: issueId,
      before: { status: issue.status },
      after: { status },
    });
    return { changed: true };
  },
});
