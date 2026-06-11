import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Rate plans + tax (3.4) and notification settings (3.5): org-scoped, gated,
 * audited; integer-cents money + fractional tax validation; idempotent toggles.
 */
async function adminOrg(t: ReturnType<typeof convexTest>, bb: string) {
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: `bb_org_${bb}`, name: `Org ${bb}`, slug: bb },
    user: { bytebazaarUserId: `bb_admin_${bb}`, name: "Owner", role: "org_admin" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: ids.orgId,
    userId: ids.userId,
    ssoRole: "org_admin",
  });
  return t.withIdentity({ subject: ids.userId });
}

describe("rates & tax (3.4)", () => {
  it("creates a rate plan (int64 cents) + tax rule and validates ranges", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const as = await adminOrg(t, "A");

    const roomTypeId = await as.mutation(api.roomTypes.create, {
      name: "Std",
      capacity: 2,
    });
    const planId = await as.mutation(api.rates.createRatePlan, {
      roomTypeId,
      name: "Standard nightly",
      nightlyCents: 350000n, // KES 3,500.00
    });
    const plans = await as.query(api.rates.listRatePlans, {});
    expect(plans[0].nightlyCents).toBe(350000n);
    expect(plans[0].currency).toBe("KES");

    await as.mutation(api.rates.updateRatePlan, { ratePlanId: planId, active: false });
    expect((await as.query(api.rates.listRatePlans, {}))[0].active).toBe(false);

    await as.mutation(api.rates.createTaxRule, { name: "VAT", rate: 0.16 });
    expect((await as.query(api.rates.listTaxRules, {}))[0].rate).toBeCloseTo(0.16);

    // Validation: negative money, out-of-range tax.
    await expect(
      as.mutation(api.rates.createRatePlan, {
        roomTypeId,
        name: "Bad",
        nightlyCents: -1n,
      }),
    ).rejects.toThrow(/≥ 0/);
    await expect(
      as.mutation(api.rates.createTaxRule, { name: "Bad", rate: 1.5 }),
    ).rejects.toThrow(/fraction/);
  });

  it("denies a caller without Settings:manage", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await adminOrg(t, "A");
    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_org_A", name: "Org A", slug: "A" },
      user: { bytebazaarUserId: "bb_staff", name: "Sam", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: staffer.userId }).mutation(api.rates.createTaxRule, {
        name: "VAT",
        rate: 0.16,
      }),
    ).rejects.toThrow(/Settings:manage|FORBIDDEN/);
  });
});

describe("notification settings (3.5)", () => {
  it("upserts (type, channel) toggles idempotently and audits", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const as = await adminOrg(t, "A");

    expect(
      await as.mutation(api.notifications.setEnabled, {
        type: "booking_confirmation",
        channel: "sms",
        enabled: true,
      }),
    ).toEqual({ changed: true });
    // Same value → no-op.
    expect(
      await as.mutation(api.notifications.setEnabled, {
        type: "booking_confirmation",
        channel: "sms",
        enabled: true,
      }),
    ).toEqual({ changed: false });
    // Flip.
    await as.mutation(api.notifications.setEnabled, {
      type: "booking_confirmation",
      channel: "sms",
      enabled: false,
    });

    const settings = await as.query(api.notifications.list, {});
    expect(settings).toHaveLength(1); // upsert, not duplicate
    expect(settings[0].enabled).toBe(false);
  });

  it("requires Notifications:manage", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await adminOrg(t, "A");
    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_org_A", name: "Org A", slug: "A" },
      user: { bytebazaarUserId: "bb_staff2", name: "Sue", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: staffer.userId }).mutation(api.notifications.setEnabled, {
        type: "x",
        channel: "email",
        enabled: true,
      }),
    ).rejects.toThrow(/Notifications:manage|FORBIDDEN/);
  });
});
