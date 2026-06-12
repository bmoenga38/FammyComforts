import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Epic 10 — Reporting + the notification engine: revenue/occupancy/balances
 * (10.2), P&L + inventory (10.3), guest analytics + tax/VAT + assets (10.4),
 * and the queue→sent/failed engine transitions (10.6). CSV/PDF are client-side
 * renderings of these payloads (10.5).
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
  await as.mutation(api.rates.createTaxRule, { name: "VAT", rate: 0.16 });
  const roomId = await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "101" });
  await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "102" });
  // A paid stay: 3 nights × 3500 + 16% VAT = 12,180.00.
  const b = await as.mutation(api.deskBookings.create, {
    roomId,
    checkInDate: IN,
    checkOutDate: OUT,
    newGuest: { fullName: "Ada", phone: "+254700000001" },
    source: "walk_in",
    paymentMethod: "cash",
  });
  await as.mutation(api.payments.recordManual, {
    bookingId: b.bookingId,
    provider: "cash",
    amountCents: 1000000n, // partial — leaves 218,000 cents open
  });
  return { ...ids, as, roomId, bookingId: b.bookingId };
}

const today = new Date().toISOString().slice(0, 10);

describe("Epic 10 — reports", () => {
  it("10.2: revenue by day/method/source; balances trace the open remainder", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const r = await s.as.query(api.reports.revenue, { fromIso: today, toIso: today });
    expect(r.totalCents).toBe(1000000n);
    expect(r.byMethod).toEqual([{ key: "cash", cents: 1000000n }]);
    expect(r.bySource).toEqual([{ key: "walk_in", cents: 1000000n }]);

    const bal = await s.as.query(api.reports.balances, {});
    expect(bal.totalCents).toBe(218000n); // 1,218,000 charge − 1,000,000 paid
    expect(bal.rows[0]).toMatchObject({ guestName: "Ada", balanceCents: 218000n });
  });

  it("10.2: occupancy days + average length of stay", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const o = await s.as.query(api.reports.occupancy, { fromIso: IN, toIso: "2099-03-05" });
    expect(o.rooms).toBe(2);
    expect(o.days).toHaveLength(5);
    expect(o.days[0]).toMatchObject({ day: IN, occupied: 1, pct: 50 }); // 1 of 2
    expect(o.days[4]).toMatchObject({ occupied: 0 }); // after checkout
    expect(o.avgLengthOfStay).toBe(3);
  });

  it("10.3+10.4: P&L subtracts received purchases; tax decomposes VAT-inclusive charges", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const { productId } = await s.as.mutation(api.inventory.createProduct, {
      name: "Rice",
      unit: "kg",
      costCents: 15000n,
      reorderLevel: 5,
    });
    const { supplierId } = await s.as.mutation(api.inventory.createSupplier, { name: "AgriCo" });
    const { poId } = await s.as.mutation(api.inventory.createPurchaseOrder, {
      supplierId,
      items: [{ productId, qty: 10 }],
    });
    await s.as.mutation(api.inventory.receivePurchaseOrder, { poId });

    const pnl = await s.as.query(api.reports.pnl, { fromIso: today, toIso: today });
    expect(pnl.revenueCents).toBe(1000000n);
    expect(pnl.purchasesCents).toBe(150000n);
    expect(pnl.grossCents).toBe(850000n);

    const tax = await s.as.query(api.reports.taxVat, { fromIso: today, toIso: today });
    expect(tax.rateBps).toBe(1600n);
    expect(tax.grossCents).toBe(1218000n); // the stay charge, VAT-inclusive
    expect(tax.vatCents).toBe(168000n); // 1,218,000 × 16/116
    expect(tax.netCents).toBe(1050000n);

    const inv = await s.as.query(api.reports.inventoryReport, {});
    expect(inv.stockValueCents).toBe(150000n);
  });

  it("10.4: guest analytics counts returning guests and top spenders", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const a = await s.as.query(api.reports.guestAnalytics, {});
    expect(a.guests).toBe(1);
    expect(a.returning).toBe(0);
    expect(a.topSpenders[0]).toMatchObject({ name: "Ada", cents: 1000000n });
  });

  it("gates: reports need Reports:read", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seed(t);
    const nobody = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody", name: "Sam", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: nobody.userId }).query(api.reports.balances, {}),
    ).rejects.toThrow(/Reports:read|FORBIDDEN/);
  });
});

describe("Epic 10 — notification engine (10.6)", () => {
  it("marks push rows sent, retries sms up to 3 attempts then fails", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const ids = await t.run(async (ctx) => {
      const push = await ctx.db.insert("outboundNotifications", {
        orgId: s.orgId,
        type: "task_assignment",
        channel: "push",
        status: "queued",
        body: "Test",
      });
      const sms = await ctx.db.insert("outboundNotifications", {
        orgId: s.orgId,
        type: "booking_confirmation",
        channel: "sms",
        status: "queued",
        recipient: "+254700000001",
        body: "Karibu!",
      });
      return { push, sms };
    });

    await t.mutation(internal.notificationsEngine.markResult, { id: ids.push, ok: true });
    for (let i = 0; i < 3; i++) {
      await t.mutation(internal.notificationsEngine.markResult, {
        id: ids.sms,
        ok: false,
        error: "Gateway HTTP 500",
      });
    }
    const rows = await t.run((ctx) => ctx.db.query("outboundNotifications").collect());
    const push = rows.find((r) => r._id === ids.push);
    const sms = rows.find((r) => r._id === ids.sms);
    expect(push).toMatchObject({ status: "sent", attempts: 1 });
    expect(push?.sentAt).toBeTypeOf("number");
    expect(sms).toMatchObject({ status: "failed", attempts: 3, error: "Gateway HTTP 500" });

    // Terminal rows are not reprocessed.
    await t.mutation(internal.notificationsEngine.markResult, { id: ids.sms, ok: true });
    const after = await t.run((ctx) => ctx.db.get(ids.sms));
    expect(after?.status).toBe("failed");
  });
});
