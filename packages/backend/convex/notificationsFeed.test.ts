import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Notification feed: permission-aware item kinds, live badge count, and tenant
 * isolation. The org_admin (full grants) sees everything; a roleless user gets
 * an empty feed; org B never sees org A's items.
 */
const IN = "2099-03-01";
const OUT = "2099-03-04";

async function seedOrgWithPendingBooking(t: ReturnType<typeof convexTest>, slug: string) {
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: `bb_${slug}`, name: `Org ${slug}`, slug },
    user: { bytebazaarUserId: `bb_admin_${slug}`, name: "Owner", role: "org_admin" },
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
    idRequired: true,
  });
  const branchId = await as.mutation(api.branches.create, { propertyId, name: "Main" });
  const roomTypeId = await as.mutation(api.roomTypes.create, { name: "Std", capacity: 2 });
  await as.mutation(api.rates.createRatePlan, { roomTypeId, name: "Nightly", nightlyCents: 350000n });
  await as.mutation(api.rates.createTaxRule, { name: "VAT", rate: 0.16 });
  // Enable confirmation SMS BEFORE booking so an outbound row gets queued.
  await as.mutation(api.notifications.setEnabled, {
    type: "booking_confirmation",
    channel: "sms",
    enabled: true,
  });
  const roomId = await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "101" });
  const booking = await t.mutation(api.guestBookings.create, {
    orgSlug: slug,
    roomId,
    checkInDate: IN,
    checkOutDate: OUT,
    guest: { fullName: "Ada Guest", phone: "+254700000001", email: "ada@g.test" },
    consent: true,
    paymentMethod: "mpesa_stk",
  });
  return { ...ids, as, booking };
}

describe("notificationsFeed", () => {
  it("org_admin sees pending booking + queued SMS + guest request, count matches", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithPendingBooking(t, "acme");
    await t.mutation(api.guestRequests.submit, {
      reference: s.booking.reference,
      contact: "+254700000001",
      message: "Extra towels please",
    });

    const feed = await s.as.query(api.notificationsFeed.feed, {});
    const kinds = feed.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(["booking_pending", "guest_request", "sms_queued"]);
    expect(feed.count).toBe(3);

    const bookingItem = feed.items.find((i) => i.kind === "booking_pending")!;
    expect(bookingItem.title).toContain(s.booking.reference);
    expect(bookingItem.detail).toContain("Ada Guest");
    expect(bookingItem.detail).toContain("Rm 101");
  });

  it("a roleless org member gets an empty feed (count 0), not an error", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seedOrgWithPendingBooking(t, "acme");
    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody", name: "Sam", role: "driver" },
    });
    const feed = await t
      .withIdentity({ subject: staffer.userId })
      .query(api.notificationsFeed.feed, {});
    expect(feed).toEqual({ count: 0, items: [] });
  });

  it("never includes another org's items", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seedOrgWithPendingBooking(t, "acme");
    const b = await seedOrgWithPendingBooking(t, "beta");
    const feed = await b.as.query(api.notificationsFeed.feed, {});
    // Org beta's admin sees exactly its own 2 items (booking + sms).
    expect(feed.count).toBe(2);
    expect(
      feed.items.every((i) => !i.title.includes("acme") && i.kind !== "guest_request"),
    ).toBe(true);
  });
});
