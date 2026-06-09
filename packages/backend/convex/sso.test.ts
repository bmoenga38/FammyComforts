// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `resolveHandoff` (Story 2.1, A2) — the shared verify→upsert→consume core the
 * `sso-handoff` Convex Auth provider delegates to. The Bytebazaar call is
 * external IO, so we mock `ConvexHttpClient` and pass a fake `ctx.runMutation`;
 * this runs under the node env (not edge-runtime) so `process.env` is available.
 */
const query = vi.fn();
const mutation = vi.fn();
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({ query, mutation })),
}));

import { resolveHandoff } from "./sso";

const VERIFIED = {
  valid: true as const,
  orgId: "platform_org_id",
  userId: "bb_user_1",
  productSlug: "rental",
  org: { _id: "bb_org_1", name: "Acme Stays", slug: "acme" },
  user: {
    _id: "bb_user_1",
    name: "Ada",
    phone: "+254700000000",
    email: "ada@acme.test",
    role: "org_admin",
  },
};

beforeEach(() => {
  query.mockReset();
  mutation.mockReset();
  delete process.env.BYTEBAZAAR_CONVEX_URL;
});

describe("resolveHandoff", () => {
  it("throws SSO_NOT_CONFIGURED (and does no work) when BYTEBAZAAR_CONVEX_URL is unset", async () => {
    const ctx = { runMutation: vi.fn() };
    await expect(resolveHandoff(ctx as never, "bys_x")).rejects.toThrow(
      /SSO_NOT_CONFIGURED/,
    );
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("throws SSO_INVALID and never upserts/consumes when the handoff is invalid", async () => {
    process.env.BYTEBAZAAR_CONVEX_URL = "https://platform.convex.cloud";
    query.mockResolvedValue({ valid: false, reason: "expired" }); // truthy but invalid
    const ctx = { runMutation: vi.fn() };
    await expect(resolveHandoff(ctx as never, "bys_bad")).rejects.toThrow(
      /SSO_INVALID/,
    );
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });

  it("maps the verified payload, bootstraps RBAC, consumes the token, and returns the ids", async () => {
    process.env.BYTEBAZAAR_CONVEX_URL = "https://platform.convex.cloud";
    query.mockResolvedValue(VERIFIED);
    const ids = { userId: "u1", orgId: "o1" };
    const runMutation = vi.fn().mockResolvedValue(ids);

    const result = await resolveHandoff({ runMutation } as never, "bys_good");

    // Two mutations: identity upsert, then RBAC bootstrap.
    expect(runMutation).toHaveBeenCalledTimes(2);
    // org._id → bytebazaarOrgId, top-level userId → bytebazaarUserId
    const upsertArgs = runMutation.mock.calls[0][1];
    expect(upsertArgs.org).toEqual({
      bytebazaarOrgId: "bb_org_1",
      name: "Acme Stays",
      slug: "acme",
    });
    expect(upsertArgs.user).toEqual({
      bytebazaarUserId: "bb_user_1",
      name: "Ada",
      phone: "+254700000000",
      email: "ada@acme.test",
      role: "org_admin",
    });
    // RBAC bootstrap gets the resolved ids + the SSO role.
    expect(runMutation.mock.calls[1][1]).toEqual({
      orgId: "o1",
      userId: "u1",
      ssoRole: "org_admin",
    });
    // The one-time token is consumed.
    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      token: "bys_good",
    });
    expect(result).toEqual(ids);
  });

  it("coalesces a null upstream name to the email", async () => {
    process.env.BYTEBAZAAR_CONVEX_URL = "https://platform.convex.cloud";
    query.mockResolvedValue({
      ...VERIFIED,
      user: { ...VERIFIED.user, name: null },
    });
    const runMutation = vi.fn().mockResolvedValue({ userId: "u1", orgId: "o1" });
    await resolveHandoff({ runMutation } as never, "bys_good");
    expect(runMutation.mock.calls[0][1].user.name).toBe("ada@acme.test");
  });
});
