import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrgUser } from "./lib/auth";
import { assertDateRange, nightsBetween } from "./lib/bookingDomain";

/**
 * Availability calendar (Story 6.3). Returns each room with its current status
 * and its booking spans inside [from, to) — the web paints the per-day grid
 * (available / booked / occupied / checkout day / cleaning). Operational read:
 * any authenticated org member (read-gating policy); capped at 60 days.
 */
export const grid = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const { orgId } = await requireOrgUser(ctx);
    assertDateRange(from, to);
    if (nightsBetween(from, to) > 60) {
      throw new Error("Calendar range is capped at 60 days.");
    }

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const out = [];
    for (const room of rooms) {
      const type = await ctx.db.get(room.roomTypeId);
      const bookings = (
        await ctx.db
          .query("bookings")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect()
      ).filter(
        (b) =>
          (b.status === "pending" ||
            b.status === "confirmed" ||
            b.status === "checked_in" ||
            b.status === "checked_out") &&
          b.checkInDate < to &&
          b.checkOutDate > from,
      );
      const spans = [];
      for (const b of bookings) {
        const guest = await ctx.db.get(b.guestId);
        spans.push({
          bookingId: b._id,
          reference: b.reference,
          status: b.status,
          checkInDate: b.checkInDate,
          checkOutDate: b.checkOutDate,
          guestName: guest?.fullName ?? "—",
        });
      }
      out.push({
        roomId: room._id,
        number: room.number,
        typeName: type?.name ?? "—",
        roomStatus: room.status,
        spans,
      });
    }
    return out.sort((a, b) => a.number.localeCompare(b.number));
  },
});
