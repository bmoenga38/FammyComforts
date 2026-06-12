import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Epic 8 — Inventory & Procurement: product catalog with opening stock (8.1),
 * supplier + PO receive flow (8.2), the movements audit trail (8.3), stocktake
 * variances (8.4), and usage + low-stock escalation (8.5).
 */
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
  return { ...ids, as: t.withIdentity({ subject: ids.userId }) };
}

describe("Epic 8 — inventory & procurement", () => {
  it("8.1+8.3: creates a product; opening stock is an audited movement", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    await s.as.mutation(api.inventory.createProduct, {
      name: "Bath towels",
      category: "linen",
      unit: "pcs",
      costCents: 80000n,
      openingQty: 40,
      reorderLevel: 10,
    });
    const [p] = await s.as.query(api.inventory.products, {});
    expect(p).toMatchObject({ name: "Bath towels", stockQty: 40, low: false });

    const moves = await s.as.query(api.inventory.movements, {});
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ deltaQty: 40, reason: "adjustment", actorName: "Owner" });
  });

  it("8.2: PO create + receive restocks via purchase movements", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const { productId } = await s.as.mutation(api.inventory.createProduct, {
      name: "Cooking oil",
      unit: "ltr",
      costCents: 35000n,
      reorderLevel: 5,
    });
    const { supplierId } = await s.as.mutation(api.inventory.createSupplier, {
      name: "Mombasa Wholesalers",
      phone: "+254711000000",
    });
    const { poId, totalCents } = await s.as.mutation(api.inventory.createPurchaseOrder, {
      supplierId,
      items: [{ productId, qty: 20 }],
    });
    expect(totalCents).toBe(700000n); // 20 × 350.00

    await s.as.mutation(api.inventory.receivePurchaseOrder, { poId });
    const [p] = await s.as.query(api.inventory.products, {});
    expect(p.stockQty).toBe(20);
    const [po] = await s.as.query(api.inventory.purchaseOrders, {});
    expect(po.status).toBe("received");
    // Receiving twice is rejected (no double restock).
    await expect(
      s.as.mutation(api.inventory.receivePurchaseOrder, { poId }),
    ).rejects.toThrow(/Already received/);
  });

  it("8.4: stocktake posts variances and corrects on-hand", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const { productId } = await s.as.mutation(api.inventory.createProduct, {
      name: "Soap bars",
      unit: "pcs",
      costCents: 5000n,
      openingQty: 100,
      reorderLevel: 20,
    });
    const { variances } = await s.as.mutation(api.inventory.stocktake, {
      counts: [{ productId, countedQty: 93 }],
    });
    expect(variances).toBe(1);
    const [p] = await s.as.query(api.inventory.products, {});
    expect(p.stockQty).toBe(93);
    const moves = await s.as.query(api.inventory.movements, { productId });
    expect(moves[0]).toMatchObject({ deltaQty: -7, reason: "stocktake" });
  });

  it("8.5: usage decrements; crossing the reorder level raises low_stock once", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const { productId } = await s.as.mutation(api.inventory.createProduct, {
      name: "Detergent",
      unit: "kg",
      costCents: 20000n,
      openingQty: 12,
      reorderLevel: 10,
    });
    await s.as.mutation(api.inventory.recordUsage, { productId, qty: 3 });
    let escalations = await s.as.query(api.escalations.list, {});
    expect(escalations.filter((e) => e.trigger === "low_stock")).toHaveLength(1);

    // Further usage below the threshold doesn't duplicate the open alert.
    await s.as.mutation(api.inventory.recordUsage, { productId, qty: 2 });
    escalations = await s.as.query(api.escalations.list, {});
    expect(escalations.filter((e) => e.trigger === "low_stock")).toHaveLength(1);

    // Over-consumption is blocked.
    await expect(
      s.as.mutation(api.inventory.recordUsage, { productId, qty: 999 }),
    ).rejects.toThrow(/Insufficient stock/);
  });

  it("gates: catalog admin needs Inventory:manage; POs need Purchases:write", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seed(t);
    const nobody = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody", name: "Sam", role: "driver" },
    });
    const asNobody = t.withIdentity({ subject: nobody.userId });
    await expect(
      asNobody.mutation(api.inventory.createProduct, {
        name: "X",
        unit: "pcs",
        costCents: 1n,
        reorderLevel: 0,
      }),
    ).rejects.toThrow(/Inventory:manage|FORBIDDEN/);
    await expect(asNobody.query(api.inventory.products, {})).rejects.toThrow(
      /Inventory:read|FORBIDDEN/,
    );
  });
});
