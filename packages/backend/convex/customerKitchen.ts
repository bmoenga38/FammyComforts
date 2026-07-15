import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser } from "./lib/auth";

/**
 * Customer-facing food ordering (R3). Guests have no RBAC Restaurant grant, so
 * these functions gate on `requireOrgUser` only (any authenticated org member)
 * and are scoped to the caller's org. A placed order lands as a normal `orders`
 * row in the `pending` lane, so it shows up on the staff Kitchen board and for
 * admin/ops automatically — no separate pipeline. `placedByUserId` links it back
 * to the guest so they can track it.
 */

/** The active menu a guest can order from (name + price only). */
export const menu = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return items
      .filter((m) => m.active)
      .map((m) => ({
        menuItemId: m._id,
        name: m.name,
        category: m.category ?? null,
        priceCents: m.priceCents,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Place a guest order (defaults to room service). Lands in the kitchen queue. */
export const placeOrder = mutation({
  args: {
    tableOrRoom: v.optional(v.string()),
    channel: v.optional(
      v.union(
        v.literal("room_service"),
        v.literal("dine_in"),
        v.literal("takeaway"),
      ),
    ),
    items: v.array(v.object({ menuItemId: v.id("menuItems"), qty: v.number() })),
  },
  handler: async (ctx, { tableOrRoom, channel, items }) => {
    const { user, orgId } = await requireOrgUser(ctx);
    if (items.length === 0) throw new Error("Add at least one item to your order.");

    const lines = [];
    let totalCents = 0n;
    for (const item of items) {
      const m = await ctx.db.get(item.menuItemId);
      if (!m || m.orgId !== orgId) throw new Error("Menu item not found.");
      if (!m.active) throw new Error(`${m.name} is not available right now.`);
      if (item.qty <= 0 || !Number.isInteger(item.qty)) {
        throw new Error("Quantities must be positive whole numbers.");
      }
      lines.push({ menuItemId: m._id, name: m.name, qty: item.qty, priceCents: m.priceCents });
      totalCents += m.priceCents * BigInt(item.qty);
    }
    const number = `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const orderId = await ctx.db.insert("orders", {
      orgId,
      number,
      channel: channel ?? "room_service",
      tableOrRoom: tableOrRoom?.trim() || undefined,
      items: lines,
      totalCents,
      currency: "KES",
      status: "pending",
      placedByUserId: user._id,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "restaurant.guest_order",
      entityType: "order",
      entityId: orderId,
      after: { number, totalCents, lines: lines.length },
    });
    return { orderId, number, totalCents };
  },
});

/** The signed-in guest's own recent orders + live kitchen status. */
export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_placed_by", (q) => q.eq("placedByUserId", user._id))
      .order("desc")
      .collect();
    return orders
      .filter((o) => o.orgId === orgId)
      .slice(0, 20)
      .map((o) => ({
        orderId: o._id,
        number: o.number,
        status: o.status,
        totalCents: o.totalCents,
        tableOrRoom: o.tableOrRoom ?? null,
        items: o.items.map((i) => ({ name: i.name, qty: i.qty })),
        at: o._creationTime,
      }));
  },
});
