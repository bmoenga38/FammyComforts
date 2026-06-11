import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser, requirePermission } from "./lib/auth";

/**
 * Rate plans + tax rules (Story 3.4) — per-org, "Settings" area. Money is
 * integer minor units (`int64` cents, never floats; NFR14); tax `rate` is a
 * fraction (0.16 = 16%). Writes need `Settings:manage` and are audited.
 */

// ---- Rate plans ----
export const listRatePlans = query({
  args: { roomTypeId: v.optional(v.id("roomTypes")) },
  handler: async (ctx, { roomTypeId }) => {
    const { orgId } = await requireOrgUser(ctx);
    if (roomTypeId) {
      return (
        await ctx.db
          .query("ratePlans")
          .withIndex("by_roomType", (q) => q.eq("roomTypeId", roomTypeId))
          .collect()
      ).filter((p) => p.orgId === orgId);
    }
    return await ctx.db
      .query("ratePlans")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const createRatePlan = mutation({
  args: {
    roomTypeId: v.id("roomTypes"),
    name: v.string(),
    nightlyCents: v.int64(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, { roomTypeId, name, nightlyCents, currency }) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    const type = await ctx.db.get(roomTypeId);
    if (!type || type.orgId !== orgId) {
      throw new Error("Room type not found in this organization.");
    }
    if (nightlyCents < 0n) throw new Error("nightlyCents must be ≥ 0.");

    const ratePlanId = await ctx.db.insert("ratePlans", {
      orgId,
      roomTypeId,
      name,
      nightlyCents,
      currency: currency ?? "KES",
      active: true,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "ratePlan.create",
      entityType: "ratePlan",
      entityId: ratePlanId,
      after: { name, nightlyCents, roomTypeId },
    });
    return ratePlanId;
  },
});

export const updateRatePlan = mutation({
  args: {
    ratePlanId: v.id("ratePlans"),
    name: v.optional(v.string()),
    nightlyCents: v.optional(v.int64()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { ratePlanId, ...patch }) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    const plan = await ctx.db.get(ratePlanId);
    if (!plan || plan.orgId !== orgId) {
      throw new Error("Rate plan not found in this organization.");
    }
    if (patch.nightlyCents !== undefined && patch.nightlyCents < 0n) {
      throw new Error("nightlyCents must be ≥ 0.");
    }
    await ctx.db.patch(ratePlanId, patch);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "ratePlan.update",
      entityType: "ratePlan",
      entityId: ratePlanId,
      after: patch,
    });
    return { changed: true };
  },
});

// ---- Tax rules ----
export const listTaxRules = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("taxRules")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const createTaxRule = mutation({
  args: { name: v.string(), rate: v.number() },
  handler: async (ctx, { name, rate }) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    if (rate < 0 || rate > 1) throw new Error("Tax rate must be a fraction in [0, 1].");

    const taxRuleId = await ctx.db.insert("taxRules", {
      orgId,
      name,
      rate,
      active: true,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "taxRule.create",
      entityType: "taxRule",
      entityId: taxRuleId,
      after: { name, rate },
    });
    return taxRuleId;
  },
});

export const updateTaxRule = mutation({
  args: {
    taxRuleId: v.id("taxRules"),
    name: v.optional(v.string()),
    rate: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { taxRuleId, ...patch }) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    const rule = await ctx.db.get(taxRuleId);
    if (!rule || rule.orgId !== orgId) {
      throw new Error("Tax rule not found in this organization.");
    }
    if (patch.rate !== undefined && (patch.rate < 0 || patch.rate > 1)) {
      throw new Error("Tax rate must be a fraction in [0, 1].");
    }
    await ctx.db.patch(taxRuleId, patch);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "taxRule.update",
      entityType: "taxRule",
      entityId: taxRuleId,
      after: patch,
    });
    return { changed: true };
  },
});
