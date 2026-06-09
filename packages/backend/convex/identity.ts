import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { getOptionalOrgUser, requireOrgUser } from "./lib/auth";

/**
 * SSO identity cache (Epic 2, Story 2.1).
 *
 * `upsertFromHandoff` is the write seam the `/sso` route calls after a verified
 * Bytebazaar handoff; `me` / `listOrgStaff` are the org-scoped reads that prove
 * a session resolves to exactly one tenant's data. RBAC (roles/permissions) is
 * Story 2.3 — `role` here is the raw SSO role string it will refine.
 */

/**
 * Upsert the org + user resolved from Bytebazaar's `verifyHandoff` into the
 * local cache, returning the FammyComfort ids. `internal` — only the `/sso`
 * server flow may call it (never client-exposed). Idempotent: re-running with
 * the same Bytebazaar ids refreshes the cached fields in place.
 *
 * Field mapping from `verifyHandoff`'s return: `org._id → bytebazaarOrgId`,
 * top-level `userId → bytebazaarUserId`.
 */
export const upsertFromHandoff = internalMutation({
  args: {
    org: v.object({
      bytebazaarOrgId: v.string(),
      name: v.string(),
      slug: v.string(),
    }),
    user: v.object({
      bytebazaarUserId: v.string(),
      name: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      role: v.string(),
    }),
  },
  handler: async (ctx, { org, user }) => {
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_bytebazaar_org", (q) =>
        q.eq("bytebazaarOrgId", org.bytebazaarOrgId),
      )
      .unique();
    const orgId = existingOrg
      ? (await ctx.db.patch(existingOrg._id, {
          name: org.name,
          slug: org.slug,
        }),
        existingOrg._id)
      : await ctx.db.insert("organizations", org);

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_bytebazaar_user", (q) =>
        q.eq("bytebazaarUserId", user.bytebazaarUserId),
      )
      .unique();
    const userId = existingUser
      ? (await ctx.db.patch(existingUser._id, {
          orgId,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
        }),
        existingUser._id)
      : await ctx.db.insert("users", { orgId, isActive: true, ...user });

    return { orgId, userId };
  },
});

/**
 * The signed-in user's safe profile + their org, or `null` when unauthenticated
 * or inactive. Never returns the raw Bytebazaar ids or other cache internals.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const result = await getOptionalOrgUser(ctx);
    if (!result) return null;
    const { user, orgId } = result;
    const org = await ctx.db.get(orgId);
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      org: org ? { _id: org._id, name: org.name, slug: org.slug } : null,
    };
  },
});

/**
 * Staff in the caller's org — an org-scoped read used to prove tenant isolation
 * (a session for org A can never see org B's users). Every tenant-scoped query
 * follows this `requireOrgUser` → `by_org` filter shape.
 */
export const listOrgStaff = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});
