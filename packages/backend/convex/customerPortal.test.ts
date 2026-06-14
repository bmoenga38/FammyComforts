import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Customer portal: a signed-in customer is matched to their bookings by phone
 * (last-9) / email, and sees their home summary, trips, and profile — never
 * another guest's data.
 */
const IN = "2099-04-01";
const OUT = "2099-04-03";

async function setup(t: ReturnType<typeof convexTest>) {
  // Org + a priced room via an admin.
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
    user: { bytebazaarUserId: "bb_admin", name: "Owner", role: "org_admin" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: ids.orgId,
    userId: ids.userId,
    ssoRole: "org_admin",
  });
  const as = t.withIdentity({ subject: ids.userId });
  const propertyId = await as.mutation(api.property.create, {
    name: "P",
    checkInTime: "14:00",
    checkOutTime: "10:00",
    idRequired: false,
  });
  const branchId = await as.mutation(api.branches.create, { propertyId, name: "Main" });
  const roomTypeId = await as.mutation(api.roomTypes.create, { name: "Deluxe", capacity: 2 });
  await as.mutation(api.rates.createRatePlan, { roomTypeId, name: "N", nightlyCents: 350000n });
  const roomId = await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "101" });

  // A customer user whose phone matches the booking guest.
  const cust = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
    user: { bytebazaarUserId: "bb_cust", name: "Ada Guest", role: "customer" },
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(cust.userId, {
      phone: "+254700000001",
      tier: "Gold",
      points: 2100,
      vip: true,
    });
  });
  return { ids, roomId, custId: cust.userId, orgId: ids.orgId };
}

describe("customerPortal", () => {
  it("summary + trips reflect the customer's own booking; profile shows loyalty", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await setup(t);

    // Public booking under the customer's phone.
    await t.mutation(api.guestBookings.create, {
      orgSlug: "acme",
      roomId: s.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      guest: { fullName: "Ada Guest", phone: "+254700000001", idNumber: "12345678" },
      consent: true,
      paymentMethod: "cash",
    });

    const asCust = t.withIdentity({ subject: s.custId });
    const summary = await asCust.query(api.customerPortal.summary, {});
    expect(summary.name).toBe("Ada Guest");
    expect(summary.tier).toBe("Gold");
    expect(summary.points).toBe(2100);
    expect(summary.activeReservation?.roomType).toBe("Deluxe");
    expect(summary.featured.length).toBeGreaterThan(0);

    const trips = await asCust.query(api.customerPortal.trips, {});
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({ roomType: "Deluxe", status: "pending" });

    const profile = await asCust.query(api.customerPortal.profile, {});
    expect(profile).toMatchObject({ name: "Ada Guest", tier: "Gold", vip: true, tripCount: 1 });
  });

  it("a customer with no matching bookings sees an empty trips list", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await setup(t);
    const asCust = t.withIdentity({ subject: s.custId });
    expect(await asCust.query(api.customerPortal.trips, {})).toHaveLength(0);
    const summary = await asCust.query(api.customerPortal.summary, {});
    expect(summary.activeReservation).toBeNull();
  });
});
