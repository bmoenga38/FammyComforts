import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Property & branch settings (Story 3.1): org-scoped, gated by `Settings:*`,
 * audited, with time-format validation and tenant isolation.
 */
async function admin(t: ReturnType<typeof convexTest>, bb: string) {
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: `bb_org_${bb}`, name: `Org ${bb}`, slug: bb },
    user: { bytebazaarUserId: `bb_admin_${bb}`, name: "Owner", role: "org_admin" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: ids.orgId,
    userId: ids.userId,
    ssoRole: "org_admin", // → Property Admin (full Settings)
  });
  return ids;
}

const PROP = {
  name: "Fammy Comforts Nairobi",
  checkInTime: "14:00",
  checkOutTime: "10:00",
  idRequired: true,
};

describe("property/branch (3.1)", () => {
  it("creates + updates a property (audited) and rejects bad times", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await admin(t, "A");
    const as = t.withIdentity({ subject: a.userId });

    const propertyId = await as.mutation(api.property.create, PROP);
    const props = await as.query(api.property.list, {});
    expect(props).toHaveLength(1);
    expect(props[0].checkInTime).toBe("14:00");

    await as.mutation(api.property.update, { propertyId, checkOutTime: "11:00" });
    const updated = await as.query(api.property.list, {});
    expect(updated[0].checkOutTime).toBe("11:00");

    await expect(
      as.mutation(api.property.create, { ...PROP, checkInTime: "25:00" }),
    ).rejects.toThrow(/HH:MM/);

    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .filter((q) => q.eq(q.field("entityType"), "property"))
        .collect(),
    );
    expect(audits.map((x) => x.action)).toEqual(
      expect.arrayContaining(["property.create", "property.update"]),
    );
  });

  it("manages branches under a property and never crosses orgs", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await admin(t, "A");
    const b = await admin(t, "B");
    const asA = t.withIdentity({ subject: a.userId });

    const propA = await asA.mutation(api.property.create, PROP);
    const branchId = await asA.mutation(api.branches.create, {
      propertyId: propA,
      name: "Main",
      location: "CBD",
    });
    expect((await asA.query(api.branches.list, {})).length).toBe(1);

    // Org B cannot attach a branch to org A's property.
    await expect(
      t.withIdentity({ subject: b.userId }).mutation(api.branches.create, {
        propertyId: propA,
        name: "Hijack",
      }),
    ).rejects.toThrow(/not found in this organization/);

    await asA.mutation(api.branches.remove, { branchId });
    expect((await asA.query(api.branches.list, {})).length).toBe(0);
  });

  it("denies a caller without Settings permission", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await admin(t, "A");
    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_org_A", name: "Org A", slug: "A" },
      user: { bytebazaarUserId: "bb_staff", name: "Sam", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: staffer.userId }).mutation(api.property.create, PROP),
    ).rejects.toThrow(/Settings:manage|FORBIDDEN/);
  });
});
