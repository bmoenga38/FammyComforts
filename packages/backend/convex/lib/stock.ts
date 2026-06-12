import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { raiseEscalation } from "./escalate";

/**
 * The single stock-change gateway (Epic 8, FR38/FR40). EVERY change to a
 * product's on-hand quantity goes through here so the immutable
 * `stockMovements` audit row is never skipped, on-hand can never drift from
 * its movement history, and the low-stock escalation (8.5) fires exactly when
 * the reorder level is crossed downward.
 */
export async function applyStockMovement(
  ctx: MutationCtx,
  m: {
    orgId: Id<"organizations">;
    product: Doc<"products">;
    deltaQty: number; // signed; purchases +, usage −
    reason: "purchase" | "usage" | "adjustment" | "stocktake";
    refType?: string;
    refId?: string;
    actorId?: string;
  },
): Promise<{ newQty: number }> {
  if (!Number.isFinite(m.deltaQty) || m.deltaQty === 0) {
    throw new Error("Stock movement quantity must be a non-zero number.");
  }
  const newQty = m.product.stockQty + m.deltaQty;
  if (newQty < 0) {
    throw new Error(
      `Insufficient stock for ${m.product.name}: ${m.product.stockQty} on hand, ${-m.deltaQty} needed.`,
    );
  }
  await ctx.db.patch(m.product._id, { stockQty: newQty });
  await ctx.db.insert("stockMovements", {
    orgId: m.orgId,
    productId: m.product._id,
    deltaQty: m.deltaQty,
    reason: m.reason,
    refType: m.refType,
    refId: m.refId,
    actorId: m.actorId,
  });
  // Low-stock alert on the downward crossing only (FR40, ties FR30).
  if (
    m.deltaQty < 0 &&
    newQty <= m.product.reorderLevel &&
    m.product.stockQty > m.product.reorderLevel
  ) {
    await raiseEscalation(ctx, {
      orgId: m.orgId,
      trigger: "low_stock",
      message: `${m.product.name} low: ${newQty} ${m.product.unit} left (reorder at ${m.product.reorderLevel})`,
      entityType: "product",
      entityId: m.product._id,
    });
  }
  return { newQty };
}
