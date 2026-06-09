import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Audit log view (Story 2.5): org-scoped, gated by `Audit logs:read`, newest
 * first, prefix-filterable — and never leaks another org's rows or infra rows.
 */
async function adminFor(t: ReturnType<typeof convexTest>, bb: string) {
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: `bb_org_${bb}`, name: `Org ${bb}`, slug: bb },
    user: { bytebazaarUserId: `bb_admin_${bb}`, name: "Owner", role: "org_admin" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: ids.orgId,
    userId: ids.userId,
    ssoRole: "org_admin",
  });
  return ids;
}

describe("audit (2.5)", () => {
  it("returns the org's rows newest-first, supports a prefix filter, and gates on permission", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const admin = await adminFor(t, "A");
    const asAdmin = t.withIdentity({ subject: admin.userId });

    // Generate a couple of audited actions.
    const receptionist = (await asAdmin.query(api.roles.list, {})).find(
      (r) => r.name === "Receptionist",
    )!;
    await asAdmin.mutation(api.roles.setPermission, {
      roleId: receptionist._id,
      area: "Reports",
      action: "read",
      granted: true,
    });

    const all = await asAdmin.query(api.audit.list, {});
    expect(all.length).toBeGreaterThan(0);
    // Newest-first ordering.
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]._creationTime).toBeGreaterThanOrEqual(
        all[i]._creationTime,
      );
    }
    // Every row is this org's.
    expect(all.every((r) => r.orgId === admin.orgId)).toBe(true);

    // Prefix filter.
    const roleRows = await asAdmin.query(api.audit.list, { action: "role." });
    expect(roleRows.length).toBeGreaterThan(0);
    expect(roleRows.every((r) => r.action.startsWith("role."))).toBe(true);
  });

  it("never returns another org's audit rows", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await adminFor(t, "A");
    const b = await adminFor(t, "B");

    // B performs an audited action.
    const bReceptionist = (
      await t.withIdentity({ subject: b.userId }).query(api.roles.list, {})
    ).find((r) => r.name === "Receptionist")!;
    await t.withIdentity({ subject: b.userId }).mutation(api.roles.setPermission, {
      roleId: bReceptionist._id,
      area: "Reports",
      action: "read",
      granted: true,
    });

    const seenByA = await t
      .withIdentity({ subject: a.userId })
      .query(api.audit.list, {});
    expect(seenByA.every((r) => r.orgId === a.orgId)).toBe(true);
  });

  it("denies a caller without Audit logs:read", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    // A Receptionist has no Audit-logs permission.
    const admin = await adminFor(t, "A");
    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_org_A", name: "Org A", slug: "A" },
      user: { bytebazaarUserId: "bb_staff", name: "Sam", role: "driver" },
    });
    const receptionist = (
      await t.withIdentity({ subject: admin.userId }).query(api.roles.list, {})
    ).find((r) => r.name === "Receptionist")!;
    await t.withIdentity({ subject: admin.userId }).mutation(api.staff.assignRole, {
      userId: staffer.userId,
      roleId: receptionist._id,
    });

    await expect(
      t.withIdentity({ subject: staffer.userId }).query(api.audit.list, {}),
    ).rejects.toThrow(/Audit logs:read|FORBIDDEN/);
  });
});
