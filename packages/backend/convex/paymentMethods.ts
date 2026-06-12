import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrgUser, requirePermission } from "./lib/auth";
import { orgBySlug } from "./lib/bookingDomain";

/**
 * Payment-method configuration (Story 5.1) — "Payments" area. A missing row
 * means ENABLED (sane default); an explicit row toggles it. Guest and desk
 * flows must offer only enabled methods.
 */

export const ALL_METHODS = ["mpesa_stk", "mpesa_manual", "cash", "card"] as const;
export type PaymentMethod = (typeof ALL_METHODS)[number];

const METHOD = v.union(
  v.literal("mpesa_stk"),
  v.literal("mpesa_manual"),
  v.literal("cash"),
  v.literal("card"),
);

export async function enabledMethodsFor(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<PaymentMethod[]> {
  const rows = await ctx.db
    .query("paymentMethodSettings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const disabled = new Set(rows.filter((r) => !r.enabled).map((r) => r.method));
  return ALL_METHODS.filter((m) => !disabled.has(m));
}

/** PUBLIC: enabled methods for the guest booking/portal flows. */
export const enabledMethods = query({
  args: { orgSlug: v.string() },
  handler: async (ctx, { orgSlug }) => {
    const org = await orgBySlug(ctx, orgSlug);
    return await enabledMethodsFor(ctx, org._id);
  },
});

/** Staff view: every method with its effective enabled state. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    const enabled = new Set(await enabledMethodsFor(ctx, orgId));
    return ALL_METHODS.map((method) => ({ method, enabled: enabled.has(method) }));
  },
});

/** Toggle a method (Payments:manage), audited. Upserts the row. */
export const setEnabled = mutation({
  args: { method: METHOD, enabled: v.boolean() },
  handler: async (ctx, { method, enabled }) => {
    const { user, orgId } = await requirePermission(ctx, "Payments", "manage");
    const existing = await ctx.db
      .query("paymentMethodSettings")
      .withIndex("by_org_method", (q) => q.eq("orgId", orgId).eq("method", method))
      .unique();
    if (existing) {
      if (existing.enabled === enabled) return { changed: false };
      await ctx.db.patch(existing._id, { enabled });
    } else {
      await ctx.db.insert("paymentMethodSettings", { orgId, method, enabled });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "paymentMethod.set_enabled",
      entityType: "paymentMethodSetting",
      after: { method, enabled },
    });
    return { changed: true };
  },
});
