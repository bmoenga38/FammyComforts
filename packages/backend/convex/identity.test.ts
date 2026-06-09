import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";

/**
 * SSO identity cache + multi-tenant isolation (Story 2.1, integration spec §2).
 *
 * Asserts the app-level contract: upsert is idempotent, `me` reflects the
 * signed-in identity (and gates inactive users), and an org-A session can never
 * read org-B data. Convex Auth's own session minting is out of scope — we fake
 * the resolved session with `t.withIdentity({ subject: userId })`, which matches
 * how `lib/auth.ts` reads `getUserIdentity().subject`.
 */

const ORG_A = {
  org: { bytebazaarOrgId: "bb_org_A", name: "Acme Stays", slug: "acme" },
  user: {
    bytebazaarUserId: "bb_user_A",
    name: "Ada",
    email: "ada@acme.test",
    role: "admin",
  },
};
const ORG_B = {
  org: { bytebazaarOrgId: "bb_org_B", name: "Beta Beds", slug: "beta" },
  user: {
    bytebazaarUserId: "bb_user_B",
    name: "Ben",
    email: "ben@beta.test",
    role: "front_desk",
  },
};

describe("identity / SSO cache", () => {
  it("upsertFromHandoff creates org+user, then refreshes in place (idempotent)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));

    const first = await t.mutation(internal.identity.upsertFromHandoff, ORG_A);
    const second = await t.mutation(internal.identity.upsertFromHandoff, {
      ...ORG_A,
      user: { ...ORG_A.user, name: "Ada Lovelace" }, // renamed in Bytebazaar
    });

    // Same ids both times — no duplicate rows.
    expect(second.orgId).toEqual(first.orgId);
    expect(second.userId).toEqual(first.userId);

    const orgs = await t.run((ctx) => ctx.db.query("organizations").collect());
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(orgs).toHaveLength(1);
    expect(users).toHaveLength(1);
    expect(users[0]?.name).toBe("Ada Lovelace");
    expect(users[0]?.isActive).toBe(true);
  });

  it("me returns the signed-in profile + org, and null when unauthenticated", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { userId } = await t.mutation(
      internal.identity.upsertFromHandoff,
      ORG_A,
    );

    expect(await t.query(api.identity.me, {})).toBeNull(); // no identity

    const me = await t.withIdentity({ subject: userId }).query(api.identity.me, {});
    expect(me?.name).toBe("Ada");
    expect(me?.org?.slug).toBe("acme");
    // Safe profile must not leak cache internals.
    expect(me).not.toHaveProperty("bytebazaarUserId");
  });

  it("inactive users cannot resolve a session (me → null)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { userId } = await t.mutation(
      internal.identity.upsertFromHandoff,
      ORG_A,
    );
    await t.run((ctx) => ctx.db.patch(userId, { isActive: false }));

    const me = await t.withIdentity({ subject: userId }).query(api.identity.me, {});
    expect(me).toBeNull();
  });

  it("tenant isolation: an org-A session never sees org-B users", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await t.mutation(internal.identity.upsertFromHandoff, ORG_A);
    await t.mutation(internal.identity.upsertFromHandoff, ORG_B);

    const seenByA = await t
      .withIdentity({ subject: a.userId })
      .query(api.identity.listOrgStaff, {});

    expect(seenByA).toHaveLength(1);
    expect(seenByA[0]?.bytebazaarUserId).toBe("bb_user_A");
    expect(seenByA.map((u) => u.orgId)).toEqual([a.orgId]);
  });

  it("listOrgStaff rejects an unauthenticated caller", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await expect(t.query(api.identity.listOrgStaff, {})).rejects.toThrow();
  });
});
