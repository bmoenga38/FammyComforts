import { v, ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

// Convex injects `process.env` at runtime; declare the minimal shape we use
// (the backend tsconfig deliberately omits the full Node types).
declare const process: { env: Record<string, string | undefined> };

/**
 * ByteAuth SSO handoff completion (Epic 2, Story 2.1 — integration spec §4).
 *
 * This is the server-side orchestration the `/sso` web route invokes. It runs
 * as an `action` because it makes a cross-deployment call OUT to the Bytebazaar
 * platform Convex (`api.sso.verifyHandoff` / `consumeHandoff`) — queries and
 * mutations can't do external IO.
 *
 * GATED (live round-trip): needs `BYTEBAZAAR_CONVEX_URL` set on this deployment
 * and BB-1..BB-3 landed so the ByteStay tile actually issues a handoff. Until
 * then this throws `SSO_NOT_CONFIGURED` (env guard) — by design.
 */

// Bytebazaar SSO functions live in *their* deployment; their generated `api`
// isn't available in this repo, so reference them by name with loose typing.
const verifyHandoffRef = makeFunctionReference<"query">("sso:verifyHandoff");
const consumeHandoffRef = makeFunctionReference<"mutation">("sso:consumeHandoff");

/** The integration contract = Bytebazaar `verifyHandoff`'s return value. */
type VerifyResult = {
  orgId: string;
  userId: string;
  productSlug: string;
  org: { _id: string; name: string; slug: string };
  user: { name: string; phone?: string; email?: string; role: string };
};

export const completeHandoff = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    { token },
  ): Promise<{ userId: Id<"users">; orgId: Id<"organizations"> }> => {
    const bytebazaarUrl = process.env.BYTEBAZAAR_CONVEX_URL;
    if (!bytebazaarUrl) {
      throw new ConvexError({
        code: "SSO_NOT_CONFIGURED",
        message:
          "BYTEBAZAAR_CONVEX_URL is not set on this deployment — SSO is not wired yet.",
      });
    }
    const platform = new ConvexHttpClient(bytebazaarUrl);

    // 1. Verify against Bytebazaar — rejects expired / used / forged tokens and
    //    confirms the org owns the active `rental` product.
    const verified = (await platform.query(verifyHandoffRef, {
      token,
    })) as VerifyResult | null;
    if (!verified) {
      throw new ConvexError({
        code: "SSO_INVALID",
        message: "Handoff token is invalid, expired, or already used.",
      });
    }

    // 2. Upsert org + user into the local identity cache (maps Bytebazaar ids
    //    onto the cache keys: org._id → bytebazaarOrgId, userId → bytebazaarUserId).
    const { userId, orgId } = await ctx.runMutation(
      internal.identity.upsertFromHandoff,
      {
        org: {
          bytebazaarOrgId: verified.org._id,
          name: verified.org.name,
          slug: verified.org.slug,
        },
        user: {
          bytebazaarUserId: verified.userId,
          name: verified.user.name,
          phone: verified.user.phone,
          email: verified.user.email,
          role: verified.user.role,
        },
      },
    );

    // 3. Consume the handoff so the one-time token can't be replayed.
    await platform.mutation(consumeHandoffRef, { token });

    // 4. DEFERRED SEAM — mint the FammyComfort session for `userId` via
    //    `@convex-dev/auth` (a custom credentials provider that trusts this
    //    verified handoff) and hand the `/sso` route what it needs to set the
    //    session cookie. Until that provider is configured against the live
    //    deployment, the route can't complete sign-in. Returns the resolved
    //    identity so the route layer can wire the final step.
    return { userId, orgId };
  },
});
