import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Epic 7 — Operations & Housekeeping R2: task queue + assignment (7.3),
 * checklist templates + execution (7.4), maintenance/damage with ledger
 * charges (7.6), asset checkout verification (7.7), and escalations (7.8).
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
  return { ...ids, as, roomId, roomTypeId };
}

describe("Epic 7 — housekeeping R2", () => {
  it("7.3: creates + assigns tasks, queues an assignment notification", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const helper = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_mercy", name: "Mercy", role: "housekeeper" },
    });

    const { taskId } = await s.as.mutation(api.housekeeping.create, {
      roomId: s.roomId,
      priority: "high",
      notes: "Deep clean",
    });
    await s.as.mutation(api.housekeeping.assign, {
      taskId,
      assigneeId: helper.userId,
      priority: "urgent",
    });

    const tasks = await s.as.query(api.housekeeping.list, {});
    expect(tasks[0]).toMatchObject({
      priority: "urgent",
      assigneeName: "Mercy",
      status: "pending",
    });
    const queued = await t.run((ctx) =>
      ctx.db.query("outboundNotifications").collect(),
    );
    expect(queued.some((n) => n.type === "task_assignment" && n.status === "queued")).toBe(true);
  });

  it("7.4: snapshots the room-type checklist on start; items toggle", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    await s.as.mutation(api.housekeeping.setTemplate, {
      items: ["Strip & remake bed", "Bathroom", "Restock minibar"],
    });
    const { taskId } = await s.as.mutation(api.housekeeping.create, {
      roomId: s.roomId,
      priority: "normal",
    });
    await s.as.mutation(api.housekeeping.setStatus, { taskId, status: "in_progress" });
    await s.as.mutation(api.housekeeping.toggleChecklistItem, { taskId, index: 0 });

    const [task] = await s.as.query(api.housekeeping.list, {});
    expect(task.checklist).toHaveLength(3);
    expect(task.checklist?.[0]).toMatchObject({ label: "Strip & remake bed", done: true });
    expect(task.checklist?.[1].done).toBe(false);
  });

  it("7.6: damage report posts a positive ledger adjustment + escalation", async () => {
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

    await s.as.mutation(api.maintenance.report, {
      kind: "damage",
      description: "Broken mirror",
      bookingId: b.bookingId,
      roomId: s.roomId,
      chargeCents: 50000n,
    });
    const entries = await t.run((ctx) =>
      ctx.db.query("ledgerEntries").collect(),
    );
    const damage = entries.find((e) => e.memo?.includes("Broken mirror"));
    expect(damage).toMatchObject({ type: "adjustment", amountCents: 50000n });

    const escalations = await s.as.query(api.escalations.list, {});
    expect(escalations.some((e) => e.trigger === "damaged_asset")).toBe(true);

    const issues = await s.as.query(api.maintenance.list, {});
    expect(issues[0]).toMatchObject({ kind: "damage", status: "open", roomNumber: "101" });
  });

  it("7.7: asset checkout verification charges + escalates discrepancies", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    await s.as.mutation(api.assets.add, { roomId: s.roomId, name: "Smart TV" });
    const { assetId: kettleId } = await s.as.mutation(api.assets.add, {
      roomId: s.roomId,
      name: "Kettle",
    });
    const assets = await s.as.query(api.assets.listByRoom, { roomId: s.roomId });
    expect(assets).toHaveLength(2);

    const b = await s.as.mutation(api.deskBookings.create, {
      roomId: s.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      newGuest: { fullName: "Ada", phone: "+254700000001" },
      source: "walk_in",
      paymentMethod: "cash",
    });
    const result = await s.as.mutation(api.assets.verifyCheckout, {
      bookingId: b.bookingId,
      results: assets.map((a) =>
        a.assetId === kettleId
          ? { assetId: a.assetId, condition: "missing" as const, chargeCents: 20000n }
          : { assetId: a.assetId, condition: "present" as const },
      ),
    });
    expect(result).toMatchObject({ verified: 2, discrepancies: 1, chargedCents: 20000n });

    const escalations = await s.as.query(api.escalations.list, {});
    expect(escalations.some((e) => e.trigger === "missing_asset")).toBe(true);
  });

  it("7.8: hourly sweep raises unpaid-balance escalations; resolve closes them", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const today = new Date().toISOString().slice(0, 10);
    // A checked-in stay at its departure date with an open charge.
    await t.run(async (ctx) => {
      const guestId = await ctx.db.insert("guests", {
        orgId: s.orgId,
        fullName: "Late Larry",
        phone: "+254700000009",
        consentAt: Date.now(),
      });
      const bookingId = await ctx.db.insert("bookings", {
        orgId: s.orgId,
        reference: "BK-LATE01",
        guestId,
        roomId: s.roomId,
        checkInDate: "2026-01-01",
        checkOutDate: today,
        status: "checked_in",
        source: "direct",
        expectedTotalCents: 100000n,
        currency: "KES",
        paymentMethod: "cash",
      });
      await ctx.db.insert("ledgerEntries", {
        orgId: s.orgId,
        bookingId,
        type: "charge",
        amountCents: 100000n,
        currency: "KES",
      });
    });

    const { raised } = await t.mutation(internal.escalations.sweep, {});
    expect(raised).toBeGreaterThanOrEqual(1);
    let open = await s.as.query(api.escalations.list, {});
    const unpaid = open.find((e) => e.trigger === "unpaid_balance");
    expect(unpaid).toBeDefined();

    // Re-sweeping does not duplicate; resolving closes it.
    await t.mutation(internal.escalations.sweep, {});
    open = await s.as.query(api.escalations.list, {});
    expect(open.filter((e) => e.trigger === "unpaid_balance")).toHaveLength(1);
    await s.as.mutation(api.escalations.resolve, { escalationId: unpaid!.escalationId });
    open = await s.as.query(api.escalations.list, {});
    expect(open.some((e) => e.trigger === "unpaid_balance")).toBe(false);
  });

  it("gates: assignment needs Housekeeping:manage, reports need Maintenance:write", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const { taskId } = await s.as.mutation(api.housekeeping.create, {
      roomId: s.roomId,
      priority: "normal",
    });
    const nobody = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody", name: "Sam", role: "driver" },
    });
    const asNobody = t.withIdentity({ subject: nobody.userId });
    await expect(
      asNobody.mutation(api.housekeeping.assign, { taskId, assigneeId: nobody.userId }),
    ).rejects.toThrow(/Housekeeping:manage|FORBIDDEN/);
    await expect(
      asNobody.mutation(api.maintenance.report, { kind: "maintenance", description: "x" }),
    ).rejects.toThrow(/Maintenance:write|FORBIDDEN/);
  });
});
