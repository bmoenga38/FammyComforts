import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";
import { normPhone } from "./lib/demoPhone";

/**
 * Demo auth backing: last-9-digit phone matching, admins unreachable by phone,
 * Bronze/+100 registration with duplicate fallback, case-insensitive admin
 * lookup, idempotent 12-user seed with RBAC role wiring.
 */
async function seeded(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.devSeed.seedDemo, {});
  return await t.mutation(internal.demoAuth.seedDemoUsers, {});
}

describe("normPhone", () => {
  it("matches on the last 9 digits across formats", () => {
    expect(normPhone("0792697197")).toBe("792697197");
    expect(normPhone("+254 792 697 197")).toBe("792697197");
    expect(normPhone("254792697197")).toBe("792697197");
    expect(normPhone("12345")).toBe("");
  });
});

describe("demoAuth", () => {
  it("seeds the 12 users idempotently with RBAC roles and guest rows", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const first = await seeded(t);
    expect(first).toEqual({ created: 12, skipped: 0 });
    const again = await t.mutation(internal.demoAuth.seedDemoUsers, {});
    expect(again).toEqual({ created: 0, skipped: 12 });

    // Staff got real RBAC permissions: Grace (Receptionist) can write bookings.
    const grace = await t.mutation(internal.demoAuth.lookupByPhone, {
      phone: "0711203040",
    });
    expect(grace.found).toBe(true);
    const perms = await t
      .withIdentity({ subject: grace.userId! })
      .query(api.roles.myPermissions, {});
    expect(perms).toContain("Bookings:write");

    // The 5 customers also exist as desk-visible guest records.
    const guests = await t.run((ctx) => ctx.db.query("guests").collect());
    expect(guests.filter((g) => g.fullName === "Janet Nyambura")).toHaveLength(1);
  });

  it("phone lookup matches any format and never returns admins", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seeded(t);
    const janet = await t.mutation(internal.demoAuth.lookupByPhone, {
      phone: "+254 712 814 151",
    });
    expect(janet).toMatchObject({ found: true, name: "Janet Nyambura", role: "customer" });
    const janet2 = await t.mutation(internal.demoAuth.lookupByPhone, {
      phone: "0712814151",
    });
    expect(janet2.userId).toEqual(janet.userId);

    // Brian is an admin — phone login must NOT find him.
    const brian = await t.mutation(internal.demoAuth.lookupByPhone, {
      phone: "+254792697197",
    });
    expect(brian).toEqual({ found: false });
  });

  it("registers a new customer as Bronze +100 pts; duplicate phone falls back to sign-in", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seeded(t);
    const reg = await t.mutation(internal.demoAuth.registerCustomer, {
      name: "Newbie Tester",
      phone: "0799000111",
      email: "newbie@test.ke",
    });
    expect(reg.created).toBe(true);
    const user = await t.run((ctx) => ctx.db.get(reg.userId));
    expect(user).toMatchObject({ role: "customer", tier: "Bronze", points: 100, stays: 0 });

    const dupe = await t.mutation(internal.demoAuth.registerCustomer, {
      name: "Newbie Again",
      phone: "+254 799 000 111",
    });
    expect(dupe).toMatchObject({ userId: reg.userId, created: false });
  });

  it("admin lookup is email-based and case-insensitive", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seeded(t);
    const found = await t.mutation(internal.demoAuth.lookupAdmin, {
      email: "BRIAN.MOENGA@fammycomforts.co.ke",
    });
    expect(found.found).toBe(true);
    const missing = await t.mutation(internal.demoAuth.lookupAdmin, {
      email: "grace.achieng@fammycomforts.co.ke",
    });
    expect(missing.found).toBe(false);
  });
});
