import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Epic 9 — Restaurant & Kitchen: inventory-linked menu (9.1), multi-channel
 * orders (9.2), kitchen lane transitions with usage on serve (9.3), room
 * charge vs separate payment (9.4), and revenue + top sellers (9.5).
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
  // Inventory link target (Epic 8).
  const { productId } = await as.mutation(api.inventory.createProduct, {
    name: "Tilapia fillet",
    unit: "pcs",
    costCents: 25000n,
    openingQty: 10,
    reorderLevel: 2,
  });
  const { menuItemId } = await as.mutation(api.restaurant.createMenuItem, {
    name: "Grilled tilapia",
    category: "food",
    priceCents: 95000n,
    ingredients: [{ productId, qty: 1 }],
  });
  const soda = await as.mutation(api.restaurant.createMenuItem, {
    name: "Stoney 500ml",
    category: "drink",
    priceCents: 12000n,
  });
  return { ...ids, as, productId, menuItemId, sodaId: soda.menuItemId };
}

describe("Epic 9 — restaurant & kitchen", () => {
  it("9.2+9.3: order moves through lanes; serving consumes linked stock", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const { orderId, totalCents } = await s.as.mutation(api.restaurant.createOrder, {
      channel: "dine_in",
      tableOrRoom: "T4",
      items: [
        { menuItemId: s.menuItemId, qty: 2 },
        { menuItemId: s.sodaId, qty: 2 },
      ],
    });
    expect(totalCents).toBe(214000n); // 2×950 + 2×120

    await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status: "preparing" });
    await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status: "ready" });
    await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status: "served" });

    // Two tilapia consumed; the unlinked soda touches nothing.
    const [fish] = (await s.as.query(api.inventory.products, {})).filter(
      (p) => p.name === "Tilapia fillet",
    );
    expect(fish.stockQty).toBe(8);

    // Lane order is enforced.
    await expect(
      s.as.mutation(api.restaurant.setOrderStatus, { orderId, status: "preparing" }),
    ).rejects.toThrow(/Cannot move/);
  });

  it("9.4: charges a served order to a checked-in room's ledger", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    // A checked-in desk booking to bill against.
    const propertyId = await s.as.mutation(api.property.create, {
      name: "P",
      checkInTime: "14:00",
      checkOutTime: "10:00",
      idRequired: false,
    });
    const branchId = await s.as.mutation(api.branches.create, { propertyId, name: "Main" });
    const roomTypeId = await s.as.mutation(api.roomTypes.create, { name: "Std", capacity: 2 });
    await s.as.mutation(api.rates.createRatePlan, { roomTypeId, name: "N", nightlyCents: 350000n });
    const roomId = await s.as.mutation(api.rooms.create, { branchId, roomTypeId, number: "101" });
    const b = await s.as.mutation(api.deskBookings.create, {
      roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      newGuest: { fullName: "Ada", phone: "+254700000001" },
      source: "walk_in",
      paymentMethod: "cash",
    });
    await s.as.mutation(api.deskBookings.checkIn, { bookingId: b.bookingId, idVerified: true });
    const before = await s.as.query(api.payments.forBooking, { bookingId: b.bookingId });

    const { orderId } = await s.as.mutation(api.restaurant.createOrder, {
      channel: "room_service",
      tableOrRoom: "101",
      items: [{ menuItemId: s.sodaId, qty: 3 }],
    });
    await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status: "preparing" });
    await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status: "ready" });
    await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status: "served" });
    await s.as.mutation(api.restaurant.chargeToRoom, {
      orderId,
      bookingReference: b.reference,
    });

    const after = await s.as.query(api.payments.forBooking, { bookingId: b.bookingId });
    expect(after!.balanceCents - before!.balanceCents).toBe(36000n); // 3×120 owed
    const orders = await s.as.query(api.restaurant.board, {});
    expect(orders.find((o) => o.orderId === orderId)).toMatchObject({
      status: "paid",
      charged: true,
    });
  });

  it("9.4: separate payment records a standalone confirmed payment", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const { orderId } = await s.as.mutation(api.restaurant.createOrder, {
      channel: "takeaway",
      items: [{ menuItemId: s.sodaId, qty: 1 }],
    });
    for (const status of ["preparing", "ready", "served"] as const) {
      await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status });
    }
    await s.as.mutation(api.restaurant.payOrder, { orderId, provider: "cash" });
    const payments = await t.run((ctx) => ctx.db.query("payments").collect());
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      provider: "cash",
      status: "confirmed",
      amountCents: 12000n,
    });
    expect(payments[0].bookingId).toBeUndefined(); // standalone — no booking
  });

  it("9.5: revenue + top sellers over a date range", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    for (let i = 0; i < 2; i++) {
      const { orderId } = await s.as.mutation(api.restaurant.createOrder, {
        channel: i === 0 ? "bar" : "dine_in",
        items: [{ menuItemId: s.menuItemId, qty: 1 }],
      });
      for (const status of ["preparing", "ready", "served"] as const) {
        await s.as.mutation(api.restaurant.setOrderStatus, { orderId, status });
      }
      await s.as.mutation(api.restaurant.payOrder, { orderId, provider: "cash" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const r = await s.as.query(api.restaurant.revenue, { fromIso: today, toIso: today });
    expect(r.orders).toBe(2);
    expect(r.totalCents).toBe(190000n);
    expect(r.topSellers[0]).toMatchObject({ name: "Grilled tilapia", qty: 2 });
  });

  it("gates: menu admin needs Restaurant:manage; waiters need write", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const nobody = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody", name: "Sam", role: "driver" },
    });
    const asNobody = t.withIdentity({ subject: nobody.userId });
    await expect(
      asNobody.mutation(api.restaurant.createOrder, {
        channel: "bar",
        items: [{ menuItemId: s.sodaId, qty: 1 }],
      }),
    ).rejects.toThrow(/Restaurant:write|FORBIDDEN/);
    await expect(
      asNobody.mutation(api.restaurant.createMenuItem, { name: "X", priceCents: 100n }),
    ).rejects.toThrow(/Restaurant:manage|FORBIDDEN/);
  });
});
