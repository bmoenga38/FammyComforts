import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { normPhone } from "./lib/demoPhone";

/**
 * Staff management (Story 2.4) — org-scoped. Reads require `Employees:read`,
 * writes require `Employees:manage`; every write audits atomically (AR9). Staff
 * identities are provisioned via SSO (Story 2.1) — this story manages their
 * active state and role assignments (the `userRoles` table from Story 2.3).
 */

async function roleNamesFor(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{ roleId: Id<"roles">; name: string }[]> {
  const urs = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const out: { roleId: Id<"roles">; name: string }[] = [];
  for (const ur of urs) {
    const role = await ctx.db.get(ur.roleId);
    if (role) out.push({ roleId: role._id, name: role.name });
  }
  return out;
}

/** All staff in the caller's org with their assigned roles. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Employees", "read");
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return Promise.all(
      users.map(async (u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        ssoRole: u.role,
        roles: await roleNamesFor(ctx, u._id),
      })),
    );
  },
});

/**
 * Provision a new staff member (Employees:manage). Identity is the PHONE number
 * (no username); the account starts with NO password — the user sets it on their
 * first login (phone-only first login). An optional `roleId` is assigned in the
 * same transaction. Phone must be unique within the org.
 */
export const create = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
  },
  handler: async (ctx, { name, phone, email, roleId }) => {
    const { user: actor, orgId } = await requirePermission(
      ctx,
      "Employees",
      "manage",
    );
    if (name.trim().length < 3) throw new Error("Enter the staff member's full name.");
    const needle = normPhone(phone);
    if (!needle) throw new Error("Enter a valid phone number.");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    if (existing.some((u) => u.phone && normPhone(u.phone) === needle)) {
      throw new Error("A user with that phone number already exists.");
    }

    let roleName: string | undefined;
    if (roleId) {
      const role = await ctx.db.get(roleId);
      if (!role || role.orgId !== orgId) {
        throw new Error("Role not found in this organization.");
      }
      roleName = role.name;
    }

    const userId = await ctx.db.insert("users", {
      orgId,
      bytebazaarUserId: `local:${needle}`,
      name: name.trim(),
      phone,
      email: email?.trim() || undefined,
      role: roleName ?? "staff",
      isActive: true,
    });
    if (roleId) {
      await ctx.db.insert("userRoles", { orgId, userId, roleId });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: actor._id,
      action: "staff.create",
      entityType: "user",
      entityId: userId,
      after: { name: name.trim(), phone, role: roleName },
    });
    return { userId };
  },
});

/** Activate / deactivate a staff member (cannot change your own — anti-lockout). */
export const setActive = mutation({
  args: { userId: v.id("users"), isActive: v.boolean() },
  handler: async (ctx, { userId, isActive }) => {
    const { user: actor, orgId } = await requirePermission(
      ctx,
      "Employees",
      "manage",
    );
    const target = await ctx.db.get(userId);
    if (!target || target.orgId !== orgId) {
      throw new Error("User not found in this organization.");
    }
    if (target._id === actor._id) {
      throw new Error("You cannot change your own active status.");
    }
    if (target.isActive === isActive) return { changed: false };

    await ctx.db.patch(userId, { isActive });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: actor._id,
      action: "staff.set_active",
      entityType: "user",
      entityId: userId,
      before: { isActive: target.isActive },
      after: { isActive },
    });
    return { changed: true };
  },
});

/** Assign an org role to a staff member (idempotent, audited). */
export const assignRole = mutation({
  args: { userId: v.id("users"), roleId: v.id("roles") },
  handler: async (ctx, { userId, roleId }) => {
    const { user: actor, orgId } = await requirePermission(
      ctx,
      "Employees",
      "manage",
    );
    const target = await ctx.db.get(userId);
    if (!target || target.orgId !== orgId) {
      throw new Error("User not found in this organization.");
    }
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throw new Error("Role not found in this organization.");
    }
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.some((ur) => ur.roleId === roleId)) return { changed: false };

    await ctx.db.insert("userRoles", { orgId, userId, roleId });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: actor._id,
      action: "staff.assign_role",
      entityType: "user",
      entityId: userId,
      after: { roleId, role: role.name },
    });
    return { changed: true };
  },
});

/** Remove an org role from a staff member (no-op if absent, audited). */
export const removeRole = mutation({
  args: { userId: v.id("users"), roleId: v.id("roles") },
  handler: async (ctx, { userId, roleId }) => {
    const { user: actor, orgId } = await requirePermission(
      ctx,
      "Employees",
      "manage",
    );
    const target = await ctx.db.get(userId);
    if (!target || target.orgId !== orgId) {
      throw new Error("User not found in this organization.");
    }
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const match = existing.find(
      (ur) => ur.roleId === roleId && ur.orgId === orgId,
    );
    if (!match) return { changed: false };

    await ctx.db.delete(match._id);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: actor._id,
      action: "staff.remove_role",
      entityType: "user",
      entityId: userId,
      before: { roleId },
    });
    return { changed: true };
  },
});
