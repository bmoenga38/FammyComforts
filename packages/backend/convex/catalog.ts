import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  orgBySlug,
  activeRatePlan,
  activeTaxBps,
  assertDateRange,
  nightsBetween,
  hasConflict,
  priceStay,
} from "./lib/bookingDomain";

/**
 * PUBLIC guest catalog (Stories 4.1–4.3). No session: the tenant is resolved
 * from the org slug in the route and every read filters by that orgId. Returns
 * only guest-safe fields — never internal ids beyond what booking needs, never
 * other tenants' data.
 */

/**
 * Room cards for the catalog. With dates, each room gains `available` and exact
 * multi-night pricing (subtotal/tax/total in integer cents); without dates,
 * nightly pricing only. Unpriced rooms surface with `nightlyCents: null` and
 * are not bookable online.
 */
export const rooms = query({
  args: {
    orgSlug: v.string(),
    checkIn: v.optional(v.string()),
    checkOut: v.optional(v.string()),
  },
  handler: async (ctx, { orgSlug, checkIn, checkOut }) => {
    const org = await orgBySlug(ctx, orgSlug);
    const withDates = checkIn !== undefined && checkOut !== undefined;
    if (withDates) assertDateRange(checkIn!, checkOut!);

    const taxBps = await activeTaxBps(ctx, org._id);
    const nights = withDates ? nightsBetween(checkIn!, checkOut!) : 0;

    const allRooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();

    const cards = [];
    for (const room of allRooms) {
      const type = await ctx.db.get(room.roomTypeId);
      const branch = await ctx.db.get(room.branchId);
      if (!type || !branch) continue;
      const plan = await activeRatePlan(ctx, org._id, room.roomTypeId);

      const operational =
        room.status !== "maintenance" && room.status !== "blocked";
      let available = operational && plan !== null;
      let totals: {
        subtotalCents: bigint;
        taxCents: bigint;
        totalCents: bigint;
      } | null = null;
      if (withDates && available) {
        const conflict = await hasConflict(ctx, room._id, checkIn!, checkOut!);
        available = !conflict;
        if (plan) totals = priceStay(plan.nightlyCents, nights, taxBps);
      }

      cards.push({
        roomId: room._id,
        number: room.number,
        floor: room.floor ?? null,
        status: room.status,
        branchName: branch.name,
        location: branch.location ?? null,
        typeName: type.name,
        capacity: type.capacity,
        sizeSqm: type.sizeSqm ?? null,
        nightlyCents: plan?.nightlyCents ?? null,
        currency: plan?.currency ?? "KES",
        available,
        nights: withDates ? nights : null,
        totals,
      });
    }
    return { propertyName: org.name, rooms: cards };
  },
});

/** Full room detail (Story 4.2): amenities, policies, pricing, availability. */
export const roomDetail = query({
  args: {
    orgSlug: v.string(),
    roomId: v.id("rooms"),
    checkIn: v.optional(v.string()),
    checkOut: v.optional(v.string()),
  },
  handler: async (ctx, { orgSlug, roomId, checkIn, checkOut }) => {
    const org = await orgBySlug(ctx, orgSlug);
    const room = await ctx.db.get(roomId);
    if (!room || room.orgId !== org._id) return null; // never cross-tenant

    const type = await ctx.db.get(room.roomTypeId);
    const branch = await ctx.db.get(room.branchId);
    if (!type || !branch) return null;

    const joins = await ctx.db
      .query("roomTypeAmenities")
      .withIndex("by_roomType", (q) => q.eq("roomTypeId", type._id))
      .collect();
    const amenities: string[] = [];
    for (const j of joins) {
      const a = await ctx.db.get(j.amenityId);
      if (a) amenities.push(a.name);
    }

    const property = (
      await ctx.db
        .query("properties")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect()
    )[0];
    const plan = await activeRatePlan(ctx, org._id, type._id);

    const withDates = checkIn !== undefined && checkOut !== undefined;
    let available =
      room.status !== "maintenance" && room.status !== "blocked" && plan !== null;
    let totals: {
      subtotalCents: bigint;
      taxCents: bigint;
      totalCents: bigint;
    } | null = null;
    let nights: number | null = null;
    if (withDates && available) {
      assertDateRange(checkIn!, checkOut!);
      available = !(await hasConflict(ctx, roomId, checkIn!, checkOut!));
      nights = nightsBetween(checkIn!, checkOut!);
      if (plan) {
        totals = priceStay(plan.nightlyCents, nights, await activeTaxBps(ctx, org._id));
      }
    }

    return {
      propertyName: org.name,
      number: room.number,
      floor: room.floor ?? null,
      status: room.status,
      branchName: branch.name,
      location: branch.location ?? null,
      typeName: type.name,
      capacity: type.capacity,
      sizeSqm: type.sizeSqm ?? null,
      amenities: amenities.sort(),
      nightlyCents: plan?.nightlyCents ?? null,
      currency: plan?.currency ?? "KES",
      checkInTime: property?.checkInTime ?? null,
      checkOutTime: property?.checkOutTime ?? null,
      cancellationNote: property?.cancellationNote ?? null,
      idRequired: property?.idRequired ?? true,
      available,
      nights,
      totals,
    };
  },
});
