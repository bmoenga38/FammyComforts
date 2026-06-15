import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";
import { verifyPassword } from "./lib/password";

/**
 * Phone + password account flow: phoneStatus branching (login / set-password /
 * register / blocked), self-registration, first-login password set, password
 * change (verified), and profile edits with phone-uniqueness.
 */
async function seeded(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.devSeed.seedDemo, {});
  await t.mutation(internal.demoAuth.seedDemoUsers, {});
}

describe("accounts.phoneStatus", () => {
  it("branches by phone state", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seeded(t);

    // Seeded staff have no password yet → first-login set-password.
    expect(await t.query(api.accounts.phoneStatus, { phone: "0711203040" })).toMatchObject({
      status: "set-password",
      name: "Grace Achieng",
    });
    // Admins are not reachable by phone.
    expect(await t.query(api.accounts.phoneStatus, { phone: "+254792697197" })).toEqual({
      status: "blocked",
    });
    // Unknown phone → register.
    expect(await t.query(api.accounts.phoneStatus, { phone: "0700111222" })).toEqual({
      status: "register",
    });
  });

  it("flips to login once a password is set", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seeded(t);
    const lookup = await t.query(internal.accounts.lookupForAuth, { phone: "0711203040" });
    await t.mutation(internal.accounts.storePasswordHash, {
      userId: lookup!.userId,
      passwordHash: "pbkdf2$1$00$00",
    });
    expect(await t.query(api.accounts.phoneStatus, { phone: "0711203040" })).toMatchObject({
      status: "login",
    });
  });
});

describe("accounts self-service", () => {
  it("registers a customer (Bronze + guest row) and reports hasPassword", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seeded(t);
    const reg = await t.mutation(internal.accounts.createCustomer, {
      name: "Fresh Guest",
      phone: "0788222333",
    });
    expect(reg.created).toBe(true);
    const user = await t.run((ctx) => ctx.db.get(reg.userId));
    expect(user).toMatchObject({ role: "customer", tier: "Bronze", points: 100 });
    const guests = await t.run((ctx) => ctx.db.query("guests").collect());
    expect(guests.some((g) => g.fullName === "Fresh Guest")).toBe(true);
  });

  it("changePassword sets a verifiable hash; updateProfile enforces phone uniqueness", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seeded(t);
    const grace = await t.query(internal.accounts.lookupForAuth, { phone: "0711203040" });
    const as = t.withIdentity({ subject: grace!.userId });

    await as.action(api.accounts.changePassword, { newPassword: "mysecret123" });
    const stored = await t.run((ctx) => ctx.db.get(grace!.userId));
    expect(stored!.passwordHash).toBeTruthy();
    expect(await verifyPassword("mysecret123", stored!.passwordHash!)).toBe(true);
    expect(await verifyPassword("wrongpass", stored!.passwordHash!)).toBe(false);

    // Profile edit succeeds…
    await as.mutation(api.accounts.updateProfile, { name: "Grace A." });
    expect((await t.run((ctx) => ctx.db.get(grace!.userId)))!.name).toBe("Grace A.");
    // …but a phone already used by another user is rejected (Kevin's number).
    await expect(
      as.mutation(api.accounts.updateProfile, { phone: "0722305060" }),
    ).rejects.toThrow(/already in use/i);
  });
});
