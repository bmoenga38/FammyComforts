import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireOrgUser,
  requirePermission,
  resolvePermissions,
} from "./lib/auth";
import { PERMISSION_AREAS } from "./lib/permissions";
import type { Area } from "./lib/permissions";

/**
 * Roles admin (Story 2.3) — all org-scoped. Reads require an authenticated org
 * user; every mutation is gated by `requirePermission(ctx, "Roles", "manage")`
 * and writes an `auditLogs` row in the same transaction (AR9). The web mirrors
 * `myPermissions` to gate UI, but the server is always authoritative.
 */

const actionValidator = v.union(
  v.literal("read"),
  v.literal("write"),
  v.literal("manage"),
);

/** Validate an area string against the catalog (areas are not free-form). */
function assertArea(area: string): Area {
  if (!(PERMISSION_AREAS as readonly string[]).includes(area)) {
    throw new Error(`Unknown permission area: ${area}`);
  }
  return area as Area;
}

/** All roles in the caller's org. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

/** One role plus its resolved `area:action` grants (org-scoped). */
export const getWithPermissions = query({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const { orgId } = await requireOrgUser(ctx);
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) return null; // never cross-org
    const rps = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    const grants: string[] = [];
    for (const rp of rps) {
      const perm = await ctx.db.get(rp.permissionId);
      if (perm) grants.push(`${perm.area}:${perm.action}`);
    }
    return { role, grants: grants.sort() };
  },
});

/** The signed-in caller's own `area:action` set — drives web UI gating. */
export const myPermissions = query({
  args: {},
  handler: async (ctx) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const granted = await resolvePermissions(ctx, user, orgId);
    return [...granted].sort();
  },
});

/** Create a custom role (unique name per org). Requires `Roles:manage`. */
export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, { name, description }) => {
    const { user, orgId } = await requirePermission(ctx, "Roles", "manage");
    const clash = await ctx.db
      .query("roles")
      .withIndex("by_org_name", (q) => q.eq("orgId", orgId).eq("name", name))
      .unique();
    if (clash) throw new Error(`A role named "${name}" already exists.`);

    const roleId = await ctx.db.insert("roles", {
      orgId,
      name,
      description,
      isSystem: false,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "role.create",
      entityType: "role",
      entityId: roleId,
      after: { name, description },
    });
    return roleId;
  },
});

/**
 * Grant or revoke one `area:action` on a role. Idempotent (grant no-ops if
 * present; revoke no-ops if absent). Requires `Roles:manage`.
 */
export const setPermission = mutation({
  args: {
    roleId: v.id("roles"),
    area: v.string(),
    action: actionValidator,
    granted: v.boolean(),
  },
  handler: async (ctx, { roleId, area, action, granted }) => {
    const { user, orgId } = await requirePermission(ctx, "Roles", "manage");
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throw new Error("Role not found in this organization.");
    }
    const validArea = assertArea(area);

    const perm = await ctx.db
      .query("permissions")
      .withIndex("by_area_action", (q) =>
        q.eq("area", validArea).eq("action", action),
      )
      .unique();
    if (!perm) throw new Error(`Unknown permission: ${area}:${action}`);

    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    const current = existing.find((rp) => rp.permissionId === perm._id);

    if (granted && !current) {
      await ctx.db.insert("rolePermissions", {
        orgId,
        roleId,
        permissionId: perm._id,
      });
    } else if (!granted && current) {
      await ctx.db.delete(current._id);
    } else {
      return { changed: false }; // already in the desired state
    }

    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "role.permission_change",
      entityType: "role",
      entityId: roleId,
      after: { area: validArea, action, granted },
    });
    return { changed: true };
  },
});
