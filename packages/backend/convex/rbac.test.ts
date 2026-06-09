import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";
import { PERMISSION_AREAS, ACTIONS, BASE_ROLES } from "./lib/permissions";

/**
 * RBAC (Story 2.3): seed idempotency, `requirePermission` grant/deny/anonymous,
 * org isolation, and the audited `setPermission` round-trip. Auth is faked with
 * `t.withIdentity({ subject: userId })` (matches `lib/auth.ts`).
 */

// Seed an org + a user in it, returning their ids.
async function seedOrgWithUser(
  t: ReturnType<typeof convexTest>,
  bb: string,
  role = "Receptionist",
) {
  const { orgId, userId } = await t.mutation(
    internal.identity.upsertFromHandoff,
    {
      org: { bytebazaarOrgId: `bb_org_${bb}`, name: `Org ${bb}`, slug: bb },
      user: { bytebazaarUserId: `bb_user_${bb}`, name: `User ${bb}`, role },
    },
  );
  await t.mutation(internal.rbac.seedOrg, { orgId });
  return { orgId, userId };
}

describe("rbac", () => {
  it("seeds the global catalog + per-org roles idempotently", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { orgId } = await seedOrgWithUser(t, "A");
    await t.mutation(internal.rbac.seedOrg, { orgId }); // run twice

    const perms = await t.run((ctx) => ctx.db.query("permissions").collect());
    const roles = await t.run((ctx) => ctx.db.query("roles").collect());
    expect(perms).toHaveLength(PERMISSION_AREAS.length * ACTIONS.length); // 54
    expect(roles).toHaveLength(BASE_ROLES.length); // 12 (no duplicates)
  });

  it("requirePermission grants for an assigned role and denies otherwise", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { orgId, userId } = await seedOrgWithUser(t, "A");
    await t.mutation(internal.rbac.assignRole, {
      orgId,
      userId,
      roleName: "Receptionist",
    });
    const asUser = t.withIdentity({ subject: userId });

    // Receptionist has Bookings:write but not Roles:manage.
    const perms = await asUser.query(api.roles.myPermissions, {});
    expect(perms).toContain("Bookings:write");
    expect(perms).not.toContain("Roles:manage");

    // setPermission requires Roles:manage → FORBIDDEN, no write.
    const roles = await asUser.query(api.roles.list, {});
    await expect(
      asUser.mutation(api.roles.setPermission, {
        roleId: roles[0]._id,
        area: "Bookings",
        action: "manage",
        granted: true,
      }),
    ).rejects.toThrow(/Roles:manage|FORBIDDEN/);
  });

  it("bootstrapForUser seeds the org + maps the SSO role (idempotent); unmapped → no role", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    // org_admin maps to "Property Admin"; seed happens inside bootstrap.
    const admin = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_org_X", name: "Org X", slug: "x" },
      user: { bytebazaarUserId: "bb_admin", name: "Owner", role: "org_admin" },
    });
    await t.mutation(internal.rbac.bootstrapForUser, {
      orgId: admin.orgId,
      userId: admin.userId,
      ssoRole: "org_admin",
    });
    await t.mutation(internal.rbac.bootstrapForUser, {
      orgId: admin.orgId,
      userId: admin.userId,
      ssoRole: "org_admin",
    }); // idempotent

    const adminRoles = await t.run((ctx) =>
      ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", admin.userId))
        .collect(),
    );
    expect(adminRoles).toHaveLength(1);
    const perms = await t
      .withIdentity({ subject: admin.userId })
      .query(api.roles.myPermissions, {});
    expect(perms).toContain("Roles:manage"); // Property Admin has full control

    // An unmapped SSO role (driver) gets no auto-assigned role.
    const worker = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_org_X", name: "Org X", slug: "x" },
      user: { bytebazaarUserId: "bb_worker", name: "Wendy", role: "driver" },
    });
    await t.mutation(internal.rbac.bootstrapForUser, {
      orgId: worker.orgId,
      userId: worker.userId,
      ssoRole: "driver",
    });
    const workerRoles = await t.run((ctx) =>
      ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", worker.userId))
        .collect(),
    );
    expect(workerRoles).toHaveLength(0);
  });

  it("denies an unauthenticated caller", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await expect(t.query(api.roles.myPermissions, {})).rejects.toThrow();
  });

  it("isolates roles per org (org A's session never sees org B's roles)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrgWithUser(t, "A");
    await seedOrgWithUser(t, "B");

    const rolesSeenByA = await t
      .withIdentity({ subject: a.userId })
      .query(api.roles.list, {});
    expect(rolesSeenByA).toHaveLength(BASE_ROLES.length);
    expect(rolesSeenByA.every((r) => r.orgId === a.orgId)).toBe(true);
  });

  it("setPermission grants then revokes idempotently and writes audit rows", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { orgId, userId } = await seedOrgWithUser(t, "A");
    await t.mutation(internal.rbac.assignRole, {
      orgId,
      userId,
      roleName: "Super Admin", // has Roles:manage
    });
    const admin = t.withIdentity({ subject: userId });

    const receptionist = (await admin.query(api.roles.list, {})).find(
      (r) => r.name === "Receptionist",
    )!;

    // Grant a new permission, then revoke it.
    const g1 = await admin.mutation(api.roles.setPermission, {
      roleId: receptionist._id,
      area: "Reports",
      action: "manage",
      granted: true,
    });
    expect(g1).toEqual({ changed: true });
    const g2 = await admin.mutation(api.roles.setPermission, {
      roleId: receptionist._id,
      area: "Reports",
      action: "manage",
      granted: true,
    });
    expect(g2).toEqual({ changed: false }); // idempotent

    const after = await admin.query(api.roles.getWithPermissions, {
      roleId: receptionist._id,
    });
    expect(after?.grants).toContain("Reports:manage");

    await admin.mutation(api.roles.setPermission, {
      roleId: receptionist._id,
      area: "Reports",
      action: "manage",
      granted: false,
    });
    const afterRevoke = await admin.query(api.roles.getWithPermissions, {
      roleId: receptionist._id,
    });
    expect(afterRevoke?.grants).not.toContain("Reports:manage");

    // Audit rows written for the permission changes, scoped to the org.
    const audits = await t.run((ctx) =>
      ctx.db.query("auditLogs").collect(),
    );
    const changes = audits.filter((a) => a.action === "role.permission_change");
    expect(changes.length).toBeGreaterThanOrEqual(2);
    expect(changes.every((a) => a.orgId === orgId)).toBe(true);
  });
});
