import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Operational escalations (Story 7.8, FR30). Triggers — unpaid balance, failed
 * payment, dirty room past SLA, missing/damaged asset, low stock — call this
 * helper from their owning mutation. Deduped: one OPEN escalation per
 * (trigger, entityId); re-raising while open is a no-op so noisy triggers
 * (e.g. repeated low-stock decrements) don't flood the dashboard.
 */
export async function raiseEscalation(
  ctx: MutationCtx,
  e: {
    orgId: Id<"organizations">;
    trigger:
      | "unpaid_balance"
      | "failed_payment"
      | "dirty_room_sla"
      | "missing_asset"
      | "damaged_asset"
      | "low_stock";
    message: string;
    entityType?: string;
    entityId?: string;
  },
): Promise<Id<"escalations"> | null> {
  const open = await ctx.db
    .query("escalations")
    .withIndex("by_org_status", (q) => q.eq("orgId", e.orgId).eq("status", "open"))
    .collect();
  if (open.some((x) => x.trigger === e.trigger && x.entityId === e.entityId)) {
    return null;
  }
  return await ctx.db.insert("escalations", {
    orgId: e.orgId,
    trigger: e.trigger,
    message: e.message,
    status: "open",
    entityType: e.entityType,
    entityId: e.entityId,
  });
}
