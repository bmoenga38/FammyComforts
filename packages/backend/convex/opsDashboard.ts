import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { addDaysIso } from "./lib/bookingDomain";
import { bookingBalanceCents } from "./lib/ledger";

/**
 * Daily-operations summary (prototype V.ops / V.forecast, Dashboard:read).
 * Everything is computed live from real records — no stored aggregates:
 * occupancy from room statuses, arrivals/departures from today's bookings,
 * revenue from confirmed payments (paidAt), and a forward 7-day occupancy
 * projection from booked room-nights. Historical trend charts (true revenue
 * history beyond payments, retention, satisfaction) remain Epic 10 scope.
 */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Dashboard", "read");
    const today = new Date().toISOString().slice(0, 10);

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const occupancyPct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const active = bookings.filter((b) =>
      ["pending", "confirmed", "checked_in"].includes(b.status),
    );
    const arrivalsToday = active.filter(
      (b) => b.checkInDate === today && b.status !== "checked_in",
    ).length;
    const departuresToday = bookings.filter(
      (b) => b.status === "checked_in" && b.checkOutDate === today,
    ).length;

    const tasks = await ctx.db
      .query("housekeepingTasks")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "pending"))
      .collect();
    const requests = await ctx.db
      .query("guestRequests")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "open"))
      .collect();
    const openEscalations = await ctx.db
      .query("escalations")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "open"))
      .collect();

    // 7.1: late checkouts (in-house past departure) + outstanding balances
    // across active stays (derived from the ledger — never stored).
    const lateCheckouts = bookings.filter(
      (b) => b.status === "checked_in" && b.checkOutDate < today,
    ).length;
    let outstandingCents = 0n;
    for (const b of active) {
      const bal = await bookingBalanceCents(ctx, b._id);
      if (bal > 0n) outstandingCents += bal;
    }

    // Revenue from confirmed payments, bucketed into the last 7 local days.
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const dayMs = 86_400_000;
    const startOfToday = Date.parse(`${today}T00:00:00Z`);
    const revenue7d: { day: string; cents: bigint }[] = [];
    for (let i = 6; i >= 0; i--) {
      const from = startOfToday - i * dayMs;
      const label = new Date(from).toISOString().slice(5, 10);
      let cents = 0n;
      for (const p of payments) {
        if (p.status === "confirmed" && p.paidAt && p.paidAt >= from && p.paidAt < from + dayMs) {
          cents += p.amountCents;
        }
      }
      revenue7d.push({ day: label, cents });
    }
    const revenueTodayCents = revenue7d[6]?.cents ?? 0n;

    // 10.1: settled restaurant orders today (room charges carry no payment row).
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    let restaurantTodayCents = 0n;
    for (const o of orders) {
      if (o.status === "paid" && o._creationTime >= startOfToday) {
        restaurantTodayCents += o.totalCents;
      }
    }

    // Forward occupancy: booked room-nights per day over the next 7 days.
    const next7d: { day: string; pct: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDaysIso(today, i);
      const booked = active.filter((b) => b.checkInDate <= day && b.checkOutDate > day).length;
      next7d.push({
        day: day.slice(5),
        pct: rooms.length ? Math.round((booked / rooms.length) * 100) : 0,
      });
    }

    return {
      rooms: rooms.length,
      occupied,
      occupancyPct,
      arrivalsToday,
      departuresToday,
      inHouse: bookings.filter((b) => b.status === "checked_in").length,
      pendingTasks: tasks.length,
      openRequests: requests.length,
      openEscalations: openEscalations.length,
      lateCheckouts,
      outstandingCents,
      revenueTodayCents,
      restaurantTodayCents,
      revenue7d,
      next7d,
    };
  },
});
