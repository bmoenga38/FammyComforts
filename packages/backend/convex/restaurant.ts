import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { postLedgerEntry } from "./lib/ledger";
import { applyStockMovement } from "./lib/stock";

/**
 * Restaurant & Kitchen (Epic 9). Menu items optionally link inventory
 * ingredients (9.1) — SERVING an order posts usage movements (FR41). Orders
 * span room service / dine-in / takeaway / bar (9.2) and move through kitchen
 * lanes pending → preparing → ready → served → paid (9.3, realtime via Convex
 * subscriptions). Settlement (9.4): charge-to-room posts an Epic-5 ledger
 * charge on a checked-in booking; separate payment records a standalone
 * confirmed payments row. Revenue + top sellers (9.5) aggregate paid +
 * room-charged orders.
 */

const LANES = ["pending", "preparing", "ready", "served", "paid", "cancelled"] as const;
type Lane = (typeof LANES)[number];
// Forward-only transitions (cancel allowed any time before paid).
const NEXT: Record<Lane, Lane[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: ["paid", "cancelled"], // paid via payOrder/chargeToRoom only
  paid: [],
  cancelled: [],
};

// ---------- 9.1: menu ----------

export const menu = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Restaurant", "read");
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const out = [];
    for (const m of items) {
      const ingredients = [];
      for (const ing of m.ingredients ?? []) {
        const p = await ctx.db.get(ing.productId);
        ingredients.push({ name: p?.name ?? "?", qty: ing.qty });
      }
      out.push({
        menuItemId: m._id,
        name: m.name,
        category: m.category ?? null,
        priceCents: m.priceCents,
        active: m.active,
        ingredients,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createMenuItem = mutation({
  args: {
    name: v.string(),
    category: v.optional(v.string()),
    priceCents: v.int64(),
    ingredients: v.optional(
      v.array(v.object({ productId: v.id("products"), qty: v.number() })),
    ),
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Restaurant", "manage");
    if (!args.name.trim()) throw new Error("Menu item name is required.");
    if (args.priceCents <= 0n) throw new Error("Price must be positive.");
    for (const ing of args.ingredients ?? []) {
      const p = await ctx.db.get(ing.productId);
      if (!p || p.orgId !== orgId) throw new Error("Linked product not found.");
      if (ing.qty <= 0) throw new Error("Ingredient quantities must be positive.");
    }
    const menuItemId = await ctx.db.insert("menuItems", {
      orgId,
      name: args.name.trim(),
      category: args.category?.trim() || undefined,
      priceCents: args.priceCents,
      active: true,
      ingredients: args.ingredients,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "restaurant.create_menu_item",
      entityType: "menuItem",
      entityId: menuItemId,
      after: { name: args.name.trim(), priceCents: args.priceCents },
    });
    return { menuItemId };
  },
});

export const setMenuItemActive = mutation({
  args: { menuItemId: v.id("menuItems"), active: v.boolean() },
  handler: async (ctx, { menuItemId, active }) => {
    const { orgId } = await requirePermission(ctx, "Restaurant", "manage");
    const m = await ctx.db.get(menuItemId);
    if (!m || m.orgId !== orgId) throw new Error("Menu item not found.");
    await ctx.db.patch(menuItemId, { active });
    return { ok: true };
  },
});

// ---------- 9.2: order creation ----------

export const createOrder = mutation({
  args: {
    channel: v.union(
      v.literal("room_service"),
      v.literal("dine_in"),
      v.literal("takeaway"),
      v.literal("bar"),
    ),
    tableOrRoom: v.optional(v.string()),
    items: v.array(v.object({ menuItemId: v.id("menuItems"), qty: v.number() })),
  },
  handler: async (ctx, { channel, tableOrRoom, items }) => {
    const { user, orgId } = await requirePermission(ctx, "Restaurant", "write");
    if (items.length === 0) throw new Error("An order needs at least one item.");

    const lines = [];
    let totalCents = 0n;
    for (const item of items) {
      const m = await ctx.db.get(item.menuItemId);
      if (!m || m.orgId !== orgId) throw new Error("Menu item not found.");
      if (!m.active) throw new Error(`${m.name} is not on the menu right now.`);
      if (item.qty <= 0 || !Number.isInteger(item.qty)) {
        throw new Error("Item quantities must be positive whole numbers.");
      }
      lines.push({
        menuItemId: m._id,
        name: m.name,
        qty: item.qty,
        priceCents: m.priceCents,
      });
      totalCents += m.priceCents * BigInt(item.qty);
    }
    const number = `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const orderId = await ctx.db.insert("orders", {
      orgId,
      number,
      channel,
      tableOrRoom: tableOrRoom?.trim() || undefined,
      items: lines,
      totalCents,
      currency: "KES",
      status: "pending",
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "restaurant.create_order",
      entityType: "order",
      entityId: orderId,
      after: { number, channel, totalCents, lines: lines.length },
    });
    return { orderId, number, totalCents };
  },
});

// ---------- 9.3: kitchen lanes ----------

export const board = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Restaurant", "read");
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
    return orders.slice(0, 100).map((o) => ({
      orderId: o._id,
      number: o.number,
      channel: o.channel,
      tableOrRoom: o.tableOrRoom ?? null,
      items: o.items.map((i) => ({ name: i.name, qty: i.qty, priceCents: i.priceCents })),
      totalCents: o.totalCents,
      status: o.status,
      charged: o.bookingId != null,
      at: o._creationTime,
    }));
  },
});

export const setOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("served"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, { orderId, status }) => {
    const { user, orgId } = await requirePermission(ctx, "Restaurant", "write");
    const order = await ctx.db.get(orderId);
    if (!order || order.orgId !== orgId) throw new Error("Order not found.");
    if (!NEXT[order.status].includes(status)) {
      throw new Error(`Cannot move a ${order.status} order to ${status}.`);
    }
    await ctx.db.patch(orderId, { status });

    // 9.1/FR41: serving consumes linked inventory (best effort — a missing
    // link or already-empty stock must not block service; flag via audit).
    if (status === "served") {
      for (const line of order.items) {
        const m = await ctx.db.get(line.menuItemId);
        for (const ing of m?.ingredients ?? []) {
          const product = await ctx.db.get(ing.productId);
          if (!product) continue;
          const need = ing.qty * line.qty;
          const usable = Math.min(need, product.stockQty);
          if (usable > 0) {
            await applyStockMovement(ctx, {
              orgId,
              product,
              deltaQty: -usable,
              reason: "usage",
              refType: "order",
              refId: orderId,
              actorId: user._id,
            });
          }
          if (usable < need) {
            await ctx.db.insert("auditLogs", {
              orgId,
              actorId: user._id,
              action: "restaurant.stock_short",
              entityType: "order",
              entityId: orderId,
              after: { product: product.name, needed: need, consumed: usable },
            });
          }
        }
      }
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "restaurant.set_status",
      entityType: "order",
      entityId: orderId,
      before: { status: order.status },
      after: { status },
    });
    return { changed: true };
  },
});

// ---------- 9.4: settlement ----------

/** Charge a served order to a checked-in booking's ledger (Epic 5). */
export const chargeToRoom = mutation({
  args: { orderId: v.id("orders"), bookingReference: v.string() },
  handler: async (ctx, { orderId, bookingReference }) => {
    const { user, orgId } = await requirePermission(ctx, "Restaurant", "write");
    const order = await ctx.db.get(orderId);
    if (!order || order.orgId !== orgId) throw new Error("Order not found.");
    if (order.status !== "served") throw new Error("Only served orders can be settled.");

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) => q.eq("reference", bookingReference.trim().toUpperCase()))
      .unique();
    if (!booking || booking.orgId !== orgId) throw new Error("Booking not found.");
    if (booking.status !== "checked_in") {
      throw new Error("Room charges need a checked-in booking.");
    }
    await postLedgerEntry(ctx, {
      orgId,
      bookingId: booking._id,
      type: "charge",
      amountCents: order.totalCents,
      currency: booking.currency,
      memo: `Restaurant ${order.number} (${order.channel.replaceAll("_", " ")})`,
    });
    await ctx.db.patch(orderId, { status: "paid", bookingId: booking._id });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "restaurant.charge_to_room",
      entityType: "order",
      entityId: orderId,
      after: { booking: booking.reference, totalCents: order.totalCents },
    });
    return { charged: true, reference: booking.reference };
  },
});

/** Take separate payment (cash/card/manual M-Pesa) — standalone payments row. */
export const payOrder = mutation({
  args: {
    orderId: v.id("orders"),
    provider: v.union(v.literal("cash"), v.literal("card"), v.literal("mpesa_manual")),
    receiptNumber: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, provider, receiptNumber }) => {
    const { user, orgId } = await requirePermission(ctx, "Restaurant", "write");
    const order = await ctx.db.get(orderId);
    if (!order || order.orgId !== orgId) throw new Error("Order not found.");
    if (order.status !== "served") throw new Error("Only served orders can be settled.");
    if (provider === "mpesa_manual" && !receiptNumber?.trim()) {
      throw new Error("An M-Pesa receipt code is required.");
    }
    const paymentId = await ctx.db.insert("payments", {
      orgId,
      provider,
      status: "confirmed",
      amountCents: order.totalCents,
      currency: order.currency,
      providerReceiptNumber: receiptNumber?.trim().toUpperCase(),
      paidAt: Date.now(),
      reconciled: false,
    });
    await ctx.db.patch(orderId, { status: "paid", paymentId });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "restaurant.pay_order",
      entityType: "order",
      entityId: orderId,
      after: { provider, totalCents: order.totalCents },
    });
    return { paid: true };
  },
});

// ---------- 9.5: revenue + top sellers ----------

export const revenue = query({
  args: { fromIso: v.string(), toIso: v.string() }, // inclusive date range
  handler: async (ctx, { fromIso, toIso }) => {
    const { orgId } = await requirePermission(ctx, "Restaurant", "read");
    const from = Date.parse(`${fromIso}T00:00:00Z`);
    const to = Date.parse(`${toIso}T00:00:00Z`) + 86_400_000;
    if (Number.isNaN(from) || Number.isNaN(to) || from >= to) {
      throw new Error("Invalid date range.");
    }
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const settled = orders.filter(
      (o) => o.status === "paid" && o._creationTime >= from && o._creationTime < to,
    );
    let totalCents = 0n;
    const byChannel = new Map<string, bigint>();
    const sellers = new Map<string, { name: string; qty: number; cents: bigint }>();
    for (const o of settled) {
      totalCents += o.totalCents;
      byChannel.set(o.channel, (byChannel.get(o.channel) ?? 0n) + o.totalCents);
      for (const line of o.items) {
        const s = sellers.get(line.name) ?? { name: line.name, qty: 0, cents: 0n };
        s.qty += line.qty;
        s.cents += line.priceCents * BigInt(line.qty);
        sellers.set(line.name, s);
      }
    }
    return {
      orders: settled.length,
      totalCents,
      byChannel: [...byChannel.entries()].map(([channel, cents]) => ({ channel, cents })),
      topSellers: [...sellers.values()].sort((a, b) => b.qty - a.qty).slice(0, 10),
    };
  },
});
