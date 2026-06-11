import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser, requirePermission } from "./lib/auth";

/**
 * Branches / locations (Story 3.1) — org-scoped, hang off a property. Reads need
 * `Settings:read`; writes need `Settings:manage` and are audited.
 */

/** Org branches, optionally filtered to one property. */
export const list = query({
  args: { propertyId: v.optional(v.id("properties")) },
  handler: async (ctx, { propertyId }) => {
    const { orgId } = await requireOrgUser(ctx);
    if (propertyId) {
      return (
        await ctx.db
          .query("branches")
          .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
          .collect()
      ).filter((b) => b.orgId === orgId); // never cross-org
    }
    return await ctx.db
      .query("branches")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const create = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.string(),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    const property = await ctx.db.get(args.propertyId);
    if (!property || property.orgId !== orgId) {
      throw new Error("Property not found in this organization.");
    }
    const branchId = await ctx.db.insert("branches", { orgId, ...args });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "branch.create",
      entityType: "branch",
      entityId: branchId,
      after: args,
    });
    return branchId;
  },
});

export const update = mutation({
  args: {
    branchId: v.id("branches"),
    name: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, { branchId, ...patch }) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    const branch = await ctx.db.get(branchId);
    if (!branch || branch.orgId !== orgId) {
      throw new Error("Branch not found in this organization.");
    }
    await ctx.db.patch(branchId, patch);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "branch.update",
      entityType: "branch",
      entityId: branchId,
      before: { name: branch.name, location: branch.location },
      after: patch,
    });
    return { changed: true };
  },
});

export const remove = mutation({
  args: { branchId: v.id("branches") },
  handler: async (ctx, { branchId }) => {
    const { user, orgId } = await requirePermission(ctx, "Settings", "manage");
    const branch = await ctx.db.get(branchId);
    if (!branch || branch.orgId !== orgId) {
      throw new Error("Branch not found in this organization.");
    }
    await ctx.db.delete(branchId);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "branch.remove",
      entityType: "branch",
      entityId: branchId,
      before: { name: branch.name, location: branch.location },
    });
    return { changed: true };
  },
});
