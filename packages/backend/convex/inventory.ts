import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { applyStockMovement } from "./lib/stock";

/**
 * Inventory & Procurement (Epic 8). Products (8.1) carry a cached on-hand
 * quantity that ONLY moves through lib/stock.ts (8.3 audit trail). Suppliers +
 * purchase orders (8.2) restock on receipt; stocktake (8.4) posts variances;
 * usage (8.5) decrements and raises low-stock escalations.
 *
 * Gating: catalog reads = Inventory:read; stock changes = Inventory:write;
 * product/stocktake admin = Inventory:manage; suppliers/POs = Purchases:*.
 */

// ---------- 8.1: product catalog ----------

export const products = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Inventory", "read");
    const rows = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return rows
      .map((p) => ({
        productId: p._id,
        name: p.name,
        category: p.category ?? null,
        unit: p.unit,
        costCents: p.costCents,
        priceCents: p.priceCents ?? null,
        stockQty: p.stockQty,
        reorderLevel: p.reorderLevel,
        active: p.active,
        low: p.stockQty <= p.reorderLevel,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createProduct = mutation({
  args: {
    name: v.string(),
    category: v.optional(v.string()),
    unit: v.string(),
    costCents: v.int64(),
    priceCents: v.optional(v.int64()),
    openingQty: v.optional(v.number()),
    reorderLevel: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Inventory", "manage");
    if (!args.name.trim()) throw new Error("Product name is required.");
    if (args.costCents < 0n) throw new Error("Cost cannot be negative.");
    if ((args.openingQty ?? 0) < 0 || args.reorderLevel < 0) {
      throw new Error("Quantities cannot be negative.");
    }
    const productId = await ctx.db.insert("products", {
      orgId,
      name: args.name.trim(),
      category: args.category?.trim() || undefined,
      unit: args.unit.trim() || "pcs",
      costCents: args.costCents,
      priceCents: args.priceCents,
      stockQty: 0,
      reorderLevel: args.reorderLevel,
      active: true,
    });
    // Opening stock arrives as an auditable adjustment movement (8.3).
    if (args.openingQty && args.openingQty > 0) {
      const product = (await ctx.db.get(productId))!;
      await applyStockMovement(ctx, {
        orgId,
        product,
        deltaQty: args.openingQty,
        reason: "adjustment",
        refType: "opening_stock",
        actorId: user._id,
      });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "inventory.create_product",
      entityType: "product",
      entityId: productId,
      after: { name: args.name.trim(), openingQty: args.openingQty ?? 0 },
    });
    return { productId };
  },
});

export const setProductActive = mutation({
  args: { productId: v.id("products"), active: v.boolean() },
  handler: async (ctx, { productId, active }) => {
    const { user, orgId } = await requirePermission(ctx, "Inventory", "manage");
    const p = await ctx.db.get(productId);
    if (!p || p.orgId !== orgId) throw new Error("Product not found.");
    await ctx.db.patch(productId, { active });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "inventory.set_active",
      entityType: "product",
      entityId: productId,
      after: { active },
    });
    return { ok: true };
  },
});

// ---------- 8.3 + 8.5: movements, usage, adjustment ----------

export const movements = query({
  args: { productId: v.optional(v.id("products")) },
  handler: async (ctx, { productId }) => {
    const { orgId } = await requirePermission(ctx, "Inventory", "read");
    const rows = productId
      ? (
          await ctx.db
            .query("stockMovements")
            .withIndex("by_product", (q) => q.eq("productId", productId))
            .order("desc")
            .collect()
        ).filter((m) => m.orgId === orgId)
      : await ctx.db
          .query("stockMovements")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .order("desc")
          .collect();
    const out = [];
    for (const m of rows.slice(0, 100)) {
      const product = await ctx.db.get(m.productId);
      const actorId = m.actorId ? ctx.db.normalizeId("users", m.actorId) : null;
      const actor = actorId ? await ctx.db.get(actorId) : null;
      out.push({
        movementId: m._id,
        productName: product?.name ?? "?",
        deltaQty: m.deltaQty,
        reason: m.reason,
        refType: m.refType ?? null,
        actorName: actor?.name ?? null,
        at: m._creationTime,
      });
    }
    return out;
  },
});

/** 8.5 — record consumption (restaurant prep, room consumables, …). */
export const recordUsage = mutation({
  args: {
    productId: v.id("products"),
    qty: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { productId, qty, note }) => {
    const { user, orgId } = await requirePermission(ctx, "Inventory", "write");
    const product = await ctx.db.get(productId);
    if (!product || product.orgId !== orgId) throw new Error("Product not found.");
    if (qty <= 0) throw new Error("Usage quantity must be positive.");
    const { newQty } = await applyStockMovement(ctx, {
      orgId,
      product,
      deltaQty: -qty,
      reason: "usage",
      refType: note ? "manual" : undefined,
      refId: note,
      actorId: user._id,
    });
    return { newQty };
  },
});

// ---------- 8.4: stocktake ----------

/** Enter counted quantities; variances post as stocktake movements. */
export const stocktake = mutation({
  args: {
    counts: v.array(v.object({ productId: v.id("products"), countedQty: v.number() })),
  },
  handler: async (ctx, { counts }) => {
    const { user, orgId } = await requirePermission(ctx, "Inventory", "manage");
    let variances = 0;
    for (const { productId, countedQty } of counts) {
      const product = await ctx.db.get(productId);
      if (!product || product.orgId !== orgId) throw new Error("Product not found.");
      if (countedQty < 0) throw new Error("Counted quantity cannot be negative.");
      const delta = countedQty - product.stockQty;
      if (delta === 0) continue;
      variances++;
      await applyStockMovement(ctx, {
        orgId,
        product,
        deltaQty: delta,
        reason: "stocktake",
        actorId: user._id,
      });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "inventory.stocktake",
      entityType: "product",
      after: { counted: counts.length, variances },
    });
    return { counted: counts.length, variances };
  },
});

// ---------- 8.2: suppliers + purchase orders ----------

export const suppliers = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Purchases", "read");
    const rows = await ctx.db
      .query("suppliers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return rows.map((s) => ({
      supplierId: s._id,
      name: s.name,
      phone: s.phone ?? null,
      email: s.email ?? null,
    }));
  },
});

export const createSupplier = mutation({
  args: { name: v.string(), phone: v.optional(v.string()), email: v.optional(v.string()) },
  handler: async (ctx, { name, phone, email }) => {
    const { user, orgId } = await requirePermission(ctx, "Purchases", "manage");
    if (!name.trim()) throw new Error("Supplier name is required.");
    const supplierId = await ctx.db.insert("suppliers", {
      orgId,
      name: name.trim(),
      phone,
      email,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "purchases.create_supplier",
      entityType: "supplier",
      entityId: supplierId,
      after: { name: name.trim() },
    });
    return { supplierId };
  },
});

export const purchaseOrders = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Purchases", "read");
    const rows = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
    const out = [];
    for (const po of rows) {
      const supplier = await ctx.db.get(po.supplierId);
      out.push({
        poId: po._id,
        supplierName: supplier?.name ?? "?",
        status: po.status,
        items: po.items,
        totalCents: po.totalCents,
        at: po._creationTime,
      });
    }
    return out;
  },
});

/** Create a PO (snapshot names + costs); status starts at "ordered". */
export const createPurchaseOrder = mutation({
  args: {
    supplierId: v.id("suppliers"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        qty: v.number(),
        unitCostCents: v.optional(v.int64()), // default: product cost
      }),
    ),
  },
  handler: async (ctx, { supplierId, items }) => {
    const { user, orgId } = await requirePermission(ctx, "Purchases", "write");
    const supplier = await ctx.db.get(supplierId);
    if (!supplier || supplier.orgId !== orgId) throw new Error("Supplier not found.");
    if (items.length === 0) throw new Error("A purchase order needs at least one line.");

    const lines = [];
    let totalCents = 0n;
    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      if (!product || product.orgId !== orgId) throw new Error("Product not found.");
      if (item.qty <= 0) throw new Error("Line quantities must be positive.");
      const unitCostCents = item.unitCostCents ?? product.costCents;
      if (unitCostCents < 0n) throw new Error("Cost cannot be negative.");
      lines.push({ productId: product._id, name: product.name, qty: item.qty, unitCostCents });
      totalCents += unitCostCents * BigInt(Math.round(item.qty));
    }
    const poId = await ctx.db.insert("purchaseOrders", {
      orgId,
      supplierId,
      status: "ordered",
      items: lines,
      totalCents,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "purchases.create_po",
      entityType: "purchaseOrder",
      entityId: poId,
      after: { supplier: supplier.name, lines: lines.length, totalCents },
    });
    return { poId, totalCents };
  },
});

/** Receive a PO: stock increases via purchase movements; status flips. */
export const receivePurchaseOrder = mutation({
  args: { poId: v.id("purchaseOrders") },
  handler: async (ctx, { poId }) => {
    const { user, orgId } = await requirePermission(ctx, "Purchases", "write");
    const po = await ctx.db.get(poId);
    if (!po || po.orgId !== orgId) throw new Error("Purchase order not found.");
    if (po.status === "received") throw new Error("Already received.");
    if (po.status === "cancelled") throw new Error("This PO was cancelled.");

    for (const line of po.items) {
      const product = await ctx.db.get(line.productId);
      if (!product) continue; // product deleted since ordering — skip the line
      await applyStockMovement(ctx, {
        orgId,
        product,
        deltaQty: line.qty,
        reason: "purchase",
        refType: "purchaseOrder",
        refId: poId,
        actorId: user._id,
      });
    }
    await ctx.db.patch(poId, { status: "received" });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "purchases.receive_po",
      entityType: "purchaseOrder",
      entityId: poId,
      after: { totalCents: po.totalCents },
    });
    return { received: po.items.length };
  },
});

export const cancelPurchaseOrder = mutation({
  args: { poId: v.id("purchaseOrders") },
  handler: async (ctx, { poId }) => {
    const { user, orgId } = await requirePermission(ctx, "Purchases", "write");
    const po = await ctx.db.get(poId);
    if (!po || po.orgId !== orgId) throw new Error("Purchase order not found.");
    if (po.status !== "ordered" && po.status !== "draft") {
      throw new Error(`Cannot cancel a ${po.status} PO.`);
    }
    await ctx.db.patch(poId, { status: "cancelled" });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "purchases.cancel_po",
      entityType: "purchaseOrder",
      entityId: poId,
    });
    return { ok: true };
  },
});
