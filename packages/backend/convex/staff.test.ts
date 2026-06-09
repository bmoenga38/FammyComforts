import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Staff management (Story 2.4): org-scoped list, activate/deactivate (with the
 * anti-lockout self-guard), and role assign/remove — all gated by
 * `Employees:manage` and audited. `org_admin` (→ Property Admin, full grants) is
 * the acting admin; a `driver` (no role) is the unprivileged staffer.
 */
async function setup(t: ReturnType<typeof convexTest>) {
  const admin = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: "bb_org", name: "Org", slug: "org" },
    user: { bytebazaarUserId: "bb_admin", name: "Owner", role: "org_admin" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: admin.orgId,
    userId: admin.userId,
    ssoRole: "org_admin",
  });
  const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: "bb_org", name: "Org", slug: "org" },
    user: { bytebazaarUserId: "bb_staff", name: "Sam", role: "driver" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: staffer.orgId,
    userId: staffer.userId,
    ssoRole: "driver", // unmapped → no role
  });
  return { admin, staffer };
}

describe("staff (2.4)", () => {
  it("lists org staff with roles for an authorized admin; denies the unprivileged", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { admin, staffer } = await setup(t);

    const staff = await t
      .withIdentity({ subject: admin.userId })
      .query(api.staff.list, {});
    expect(staff).toHaveLength(2);
    expect(staff.find((s) => s._id === admin.userId)?.roles[0]?.name).toBe(
      "Property Admin",
    );

    // The driver has no Employees permission → list throws.
    await expect(
      t.withIdentity({ subject: staffer.userId }).query(api.staff.list, {}),
    ).rejects.toThrow(/Employees:read|FORBIDDEN/);
  });

  it("activates/deactivates a staffer and blocks self-deactivation", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { admin, staffer } = await setup(t);
    const asAdmin = t.withIdentity({ subject: admin.userId });

    const res = await asAdmin.mutation(api.staff.setActive, {
      userId: staffer.userId,
      isActive: false,
    });
    expect(res).toEqual({ changed: true });
    const target = await t.run((ctx) => ctx.db.get(staffer.userId));
    expect(target?.isActive).toBe(false);

    // Anti-lockout: an admin cannot change their own active status.
    await expect(
      asAdmin.mutation(api.staff.setActive, {
        userId: admin.userId,
        isActive: false,
      }),
    ).rejects.toThrow(/own active status/);
  });

  it("assigns and removes a role (idempotent) and audits both", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { admin, staffer } = await setup(t);
    const asAdmin = t.withIdentity({ subject: admin.userId });

    const receptionist = (await asAdmin.query(api.roles.list, {})).find(
      (r) => r.name === "Receptionist",
    )!;

    expect(
      await asAdmin.mutation(api.staff.assignRole, {
        userId: staffer.userId,
        roleId: receptionist._id,
      }),
    ).toEqual({ changed: true });
    // idempotent
    expect(
      await asAdmin.mutation(api.staff.assignRole, {
        userId: staffer.userId,
        roleId: receptionist._id,
      }),
    ).toEqual({ changed: false });

    // The staffer now resolves Receptionist permissions.
    const perms = await t
      .withIdentity({ subject: staffer.userId })
      .query(api.roles.myPermissions, {});
    expect(perms).toContain("Bookings:write");

    expect(
      await asAdmin.mutation(api.staff.removeRole, {
        userId: staffer.userId,
        roleId: receptionist._id,
      }),
    ).toEqual({ changed: true });

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .filter((q) =>
          q.or(
            q.eq(q.field("action"), "staff.assign_role"),
            q.eq(q.field("action"), "staff.remove_role"),
            q.eq(q.field("action"), "staff.set_active"),
          ),
        )
        .collect(),
    );
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });
});
