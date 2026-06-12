import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { raiseEscalation } from "./lib/escalate";
import { bookingBalanceCents } from "./lib/ledger";

/**
 * Operational escalations (Story 7.8, FR30). Event-driven triggers raise
 * directly via lib/escalate (asset checks, low stock, failed payments); the
 * TIME-based triggers — dirty room past SLA, unpaid balance at/after departure
 * — are swept hourly by the cron below. Surfaced on the ops dashboard and the
 * notification feed; resolution is Maintenance:write (ops + caretakers).
 */

const DIRTY_SLA_MS = 4 * 60 * 60 * 1000; // 4h to start a post-checkout clean

export const list = query({
  args: {},
  handler: async (ctx, _args) => {
    const { orgId } = await requirePermission(ctx, "Dashboard", "read");
    const open = await ctx.db
      .query("escalations")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "open"))
      .order("desc")
      .collect();
    return open.map((e) => ({
      escalationId: e._id,
      trigger: e.trigger,
      message: e.message,
      at: e._creationTime,
    }));
  },
});

export const resolve = mutation({
  args: { escalationId: v.id("escalations") },
  handler: async (ctx, { escalationId }) => {
    const { user, orgId } = await requirePermission(ctx, "Maintenance", "write");
    const esc = await ctx.db.get(escalationId);
    if (!esc || esc.orgId !== orgId) throw new Error("Escalation not found.");
    if (esc.status === "resolved") return { changed: false };
    await ctx.db.patch(escalationId, { status: "resolved" });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "escalations.resolve",
      entityType: "escalation",
      entityId: escalationId,
      after: { trigger: esc.trigger },
    });
    return { changed: true };
  },
});

/** Hourly cron: raise time-based escalations across ALL orgs. */
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const orgs = await ctx.db.query("organizations").collect();
    let raised = 0;
    for (const org of orgs) {
      // Dirty room past SLA: pending cleaning task older than the SLA window.
      const pending = await ctx.db
        .query("housekeepingTasks")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", org._id).eq("status", "pending"),
        )
        .collect();
      for (const t of pending) {
        if (now - t._creationTime < DIRTY_SLA_MS) continue;
        const room = await ctx.db.get(t.roomId);
        const id = await raiseEscalation(ctx, {
          orgId: org._id,
          trigger: "dirty_room_sla",
          message: `Room ${room?.number ?? "?"} cleaning not started within SLA`,
          entityType: "housekeepingTask",
          entityId: t._id,
        });
        if (id) raised++;
      }
      // Unpaid balance: in-house/departed bookings still owing at departure day.
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();
      for (const b of bookings) {
        if (b.status !== "checked_in" || b.checkOutDate > today) continue;
        const balance = await bookingBalanceCents(ctx, b._id);
        if (balance <= 0n) continue;
        const id = await raiseEscalation(ctx, {
          orgId: org._id,
          trigger: "unpaid_balance",
          message: `${b.reference} departs with an unpaid balance`,
          entityType: "booking",
          entityId: b._id,
        });
        if (id) raised++;
      }
    }
    return { raised };
  },
});
