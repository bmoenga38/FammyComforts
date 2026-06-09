import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ACTIONS, PERMISSION_AREAS, BASE_ROLES } from "./lib/permissions";
import type { Area, Action } from "./lib/permissions";

/**
 * RBAC seeding (Story 2.3). The `permissions` catalog is global (seeded once);
 * `roles` + their default `rolePermissions` are seeded PER-ORG (each org gets
 * its own customisable copy of the 12 base roles). All seeds are idempotent
 * (Convex has no unique constraint — guard via index reads).
 */

/** Insert any missing rows of the global 18×3 permission catalog. */
async function ensureCatalog(ctx: MutationCtx): Promise<void> {
  for (const area of PERMISSION_AREAS) {
    for (const action of ACTIONS) {
      const existing = await ctx.db
        .query("permissions")
        .withIndex("by_area_action", (q) =>
          q.eq("area", area).eq("action", action),
        )
        .unique();
      if (!existing) await ctx.db.insert("permissions", { area, action });
    }
  }
}

async function permissionId(
  ctx: MutationCtx,
  area: Area,
  action: Action,
): Promise<Id<"permissions">> {
  const perm = await ctx.db
    .query("permissions")
    .withIndex("by_area_action", (q) =>
      q.eq("area", area).eq("action", action),
    )
    .unique();
  if (!perm) throw new Error(`permission ${area}:${action} not seeded`);
  return perm._id;
}

/** Ensure the catalog + the org's 12 base roles and their default grants exist. */
export async function ensureOrgRoles(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
): Promise<void> {
  await ensureCatalog(ctx);
  for (const role of BASE_ROLES) {
    const existingRole = await ctx.db
      .query("roles")
      .withIndex("by_org_name", (q) =>
        q.eq("orgId", orgId).eq("name", role.name),
      )
      .unique();
    const roleId =
      existingRole?._id ??
      (await ctx.db.insert("roles", {
        orgId,
        name: role.name,
        description: role.description,
        isSystem: true,
      }));

    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    const have = new Set(existing.map((rp) => rp.permissionId));
    for (const grant of role.grants) {
      const pid = await permissionId(ctx, grant.area, grant.action);
      if (!have.has(pid)) {
        await ctx.db.insert("rolePermissions", { orgId, roleId, permissionId: pid });
      }
    }
  }
}

/** Idempotently seed an org's roles (call on first SSO or via `npx convex run`). */
export const seedOrg = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<void> => {
    await ensureOrgRoles(ctx, orgId);
  },
});

/**
 * Assign an org's base role to a user by name (idempotent). Used to map the SSO
 * `role` string onto the RBAC model on first sign-in. Returns the roleId, or
 * `null` if no role of that name exists in the org.
 */
export const assignRole = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    roleName: v.string(),
  },
  handler: async (ctx, { orgId, userId, roleName }): Promise<Id<"roles"> | null> => {
    const role = await ctx.db
      .query("roles")
      .withIndex("by_org_name", (q) =>
        q.eq("orgId", orgId).eq("name", roleName),
      )
      .unique();
    if (!role) return null;
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.some((ur) => ur.roleId === role._id)) return role._id;
    await ctx.db.insert("userRoles", { orgId, userId, roleId: role._id });
    return role._id;
  },
});
