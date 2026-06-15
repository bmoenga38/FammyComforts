import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * staff.create — an admin provisions a phone-identified user with an optional
 * role; the account starts password-less (first-login sets it). Guards: requires
 * Employees:manage, rejects duplicate phones, assigns the role atomically.
 */
async function setup(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.devSeed.seedDemo, {});
  await t.mutation(internal.demoAuth.seedDemoUsers, {});
  const admin = await t.mutation(internal.demoAuth.lookupAdmin, {
    email: "brian.moenga@fammycomforts.co.ke",
  });
  return admin.userId!;
}

describe("staff.create", () => {
  it("provisions a user with a role and no password", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const adminId = await setup(t);
    const as = t.withIdentity({ subject: adminId });

    const roles = await as.query(api.roles.list, {});
    const reception = roles.find((r) => r.name === "Receptionist")!;

    const { userId } = await as.mutation(api.staff.create, {
      name: "New Receptionist",
      phone: "0790111222",
      roleId: reception._id,
    });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toMatchObject({ name: "New Receptionist", role: "Receptionist", isActive: true });
    expect(user!.passwordHash).toBeUndefined();

    // The new user can immediately set a password (first-login path).
    expect(await t.query(api.accounts.phoneStatus, { phone: "0790111222" })).toMatchObject({
      status: "set-password",
    });
    // And the assigned role grants Receptionist permissions.
    const perms = await t.withIdentity({ subject: userId }).query(api.roles.myPermissions, {});
    expect(perms).toContain("Bookings:write");
  });

  it("rejects a duplicate phone and unauthorized callers", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const adminId = await setup(t);
    const as = t.withIdentity({ subject: adminId });

    // Grace's number is already taken.
    await expect(
      as.mutation(api.staff.create, { name: "Clash User", phone: "0711203040" }),
    ).rejects.toThrow(/already exists/i);

    // A customer (no Employees:manage) cannot create staff.
    const janet = await t.query(internal.accounts.lookupForAuth, { phone: "0712814151" });
    await expect(
      t.withIdentity({ subject: janet!.userId }).mutation(api.staff.create, {
        name: "Sneaky Staff",
        phone: "0790333444",
      }),
    ).rejects.toThrow();
  });
});
