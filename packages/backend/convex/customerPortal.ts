import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgUser } from "./lib/auth";
import { bookingBalanceCents } from "./lib/ledger";
import { activeRatePlan } from "./lib/bookingDomain";
import { normPhone } from "./lib/demoPhone";
import { PUBLIC_ORG_SLUG } from "./lib/org";

/**
 * The signed-in customer's own data (prototype customer views: Home, Trips,
 * Rewards, Profile). A logged-in customer is matched to their guest records by
 * phone (last-9) or email within the org, so "my bookings" works without a
 * reference. All org-scoped via requireOrgUser; never leaks other guests.
 */

async function myBookings(
  ctx: QueryCtx,
  user: Doc<"users">,
  orgId: Id<"organizations">,
): Promise<Doc<"bookings">[]> {
  const guests = await ctx.db
    .query("guests")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const phone = user.phone ? normPhone(user.phone) : "";
  const email = (user.email ?? "").toLowerCase();
  const mineGuestIds = new Set(
    guests
      .filter(
        (g) =>
          (phone && normPhone(g.phone) === phone) ||
          (email && (g.email ?? "").toLowerCase() === email),
      )
      .map((g) => g._id),
  );
  if (mineGuestIds.size === 0) return [];
  const all = await ctx.db
    .query("bookings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  return all.filter((b) => mineGuestIds.has(b.guestId));
}

async function roomLabel(ctx: QueryCtx, b: Doc<"bookings">) {
  const room = await ctx.db.get(b.roomId);
  const type = room ? await ctx.db.get(room.roomTypeId) : null;
  return { roomNumber: room?.number ?? "—", roomType: type?.name ?? "Room" };
}

const ACTIVE = new Set(["pending", "confirmed", "checked_in"]);

/** Customer home: profile + active reservation + featured lounges. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const today = new Date().toISOString().slice(0, 10);

    const bookings = await myBookings(ctx, user, orgId);
    // Active reservation = checked-in, else nearest upcoming active stay.
    const candidates = bookings
      .filter((b) => ACTIVE.has(b.status) && b.checkOutDate >= today)
      .sort((a, b) => (a.checkInDate < b.checkInDate ? -1 : 1));
    const active =
      candidates.find((b) => b.status === "checked_in") ?? candidates[0] ?? null;
    let activeReservation = null;
    if (active) {
      const { roomNumber, roomType } = await roomLabel(ctx, active);
      activeReservation = {
        reference: active.reference,
        roomNumber,
        roomType,
        checkInDate: active.checkInDate,
        checkOutDate: active.checkOutDate,
        status: active.status,
        balanceCents: await bookingBalanceCents(ctx, active._id),
      };
    }

    // Featured lounges: a few available, priced rooms (newest types first).
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const featured = [];
    for (const room of rooms) {
      if (featured.length >= 4) break;
      if (room.status === "maintenance" || room.status === "blocked") continue;
      const plan = await activeRatePlan(ctx, orgId, room.roomTypeId);
      const type = await ctx.db.get(room.roomTypeId);
      featured.push({
        roomId: room._id,
        number: room.number,
        roomType: type?.name ?? "Room",
        capacity: type?.capacity ?? 2,
        nightlyCents: plan?.nightlyCents ?? null,
      });
    }

    return {
      orgSlug: PUBLIC_ORG_SLUG, // guests browse under the public alias, never "demo"
      name: user.name,
      tier: user.tier ?? "Bronze",
      points: user.points ?? 0,
      vip: user.vip ?? false,
      stays: user.stays ?? bookings.filter((b) => b.status === "checked_out").length,
      activeReservation,
      featured,
    };
  },
});

/** Trips: all the customer's bookings, newest stay first. */
export const trips = query({
  args: {},
  handler: async (ctx) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const bookings = await myBookings(ctx, user, orgId);
    const out = [];
    for (const b of bookings) {
      const { roomNumber, roomType } = await roomLabel(ctx, b);
      out.push({
        reference: b.reference,
        roomNumber,
        roomType,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        status: b.status,
        totalCents: b.expectedTotalCents,
        balanceCents: await bookingBalanceCents(ctx, b._id),
      });
    }
    out.sort((a, b) => (a.checkInDate > b.checkInDate ? -1 : 1));
    return out;
  },
});

/** Profile + rewards: identity + loyalty display fields (read-only). */
export const profile = query({
  args: {},
  handler: async (ctx) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const org = await ctx.db.get(orgId);
    const bookings = await myBookings(ctx, user, orgId);
    return {
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      role: user.role,
      tier: user.tier ?? "Bronze",
      points: user.points ?? 0,
      vip: user.vip ?? false,
      stays: user.stays ?? bookings.filter((b) => b.status === "checked_out").length,
      tripCount: bookings.length,
      memberSince: user._creationTime,
      propertyName: org?.name ?? "Fammy Comforts",
    };
  },
});
