import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Ops summary + housekeeping functions: real derived KPIs, the Start/Done/
 * Reopen transitions (completed clean frees the room), and permission gates.
 */
const IN = "2099-03-01";
const OUT = "2099-03-04";

async function seed(t: ReturnType<typeof convexTest>) {
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
  const roomTypeId = await as.mutation(api.roomTypes.create, { name: "Std", capacity: 2 });
  await as.mutation(api.rates.createRatePlan, { roomTypeId, name: "N", nightlyCents: 350000n });
  const roomId = await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "101" });
  await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "102" });
  return { ...ids, as, roomId };
}

describe("opsDashboard.summary", () => {
  it("derives occupancy, counts, and revenue from real records", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);

    // Desk booking checked in today + a cash payment → occupancy + revenue.
    const b = await s.as.mutation(api.deskBookings.create, {
      roomId: s.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      newGuest: { fullName: "Ada", phone: "+254700000001" },
      source: "walk_in",
      paymentMethod: "cash",
    });
    await s.as.mutation(api.deskBookings.checkIn, { bookingId: b.bookingId, idVerified: true });
    await s.as.mutation(api.payments.recordManual, {
      bookingId: b.bookingId,
      provider: "cash",
      amountCents: 500000n,
    });

    const sum = await s.as.query(api.opsDashboard.summary, {});
    expect(sum.rooms).toBe(2);
    expect(sum.occupied).toBe(1);
    expect(sum.occupancyPct).toBe(50);
    expect(sum.inHouse).toBe(1);
    expect(sum.revenueTodayCents).toBe(500000n); // paidAt = now → today's bucket
    expect(sum.revenue7d).toHaveLength(7);
    expect(sum.next7d).toHaveLength(7);
  });

  it("requires Dashboard:read", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seed(t);
    const nobody = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody", name: "Sam", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: nobody.userId }).query(api.opsDashboard.summary, {}),
    ).rejects.toThrow(/Dashboard:read|FORBIDDEN/);
  });
});

describe("housekeeping", () => {
  it("lists tasks, transitions Start→Done (frees the room), Reopen works", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const b = await s.as.mutation(api.deskBookings.create, {
      roomId: s.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      newGuest: { fullName: "Ada", phone: "+254700000001" },
      source: "walk_in",
      paymentMethod: "cash",
    });
    await s.as.mutation(api.deskBookings.checkIn, { bookingId: b.bookingId, idVerified: true });
    await s.as.mutation(api.payments.recordManual, {
      bookingId: b.bookingId,
      provider: "cash",
      amountCents: 1218000n,
    });
    await s.as.mutation(api.deskBookings.checkOut, {
      bookingId: b.bookingId,
      assetCheck: { ok: true },
    });

    let tasks = await s.as.query(api.housekeeping.list, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ status: "pending", roomNumber: "101" });

    await s.as.mutation(api.housekeeping.setStatus, {
      taskId: tasks[0].taskId,
      status: "in_progress",
    });
    await s.as.mutation(api.housekeeping.setStatus, {
      taskId: tasks[0].taskId,
      status: "completed",
    });
    // Completed clean returns the room to available.
    const room = await t.run((ctx) => ctx.db.get(s.roomId));
    expect(room?.status).toBe("available");

    // Reopen.
    await s.as.mutation(api.housekeeping.setStatus, {
      taskId: tasks[0].taskId,
      status: "pending",
    });
    tasks = await s.as.query(api.housekeeping.list, {});
    expect(tasks[0].status).toBe("pending");
  });

  it("gates writes by Housekeeping:write", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seed(t);
    const nobody = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody2", name: "Sue", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: nobody.userId }).query(api.housekeeping.list, {}),
    ).rejects.toThrow(/Housekeeping:read|FORBIDDEN/);
  });
});
