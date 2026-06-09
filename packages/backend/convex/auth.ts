import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { resolveHandoff } from "./sso";

/**
 * Convex Auth (Epic 2, Story 2.1 — session minting).
 *
 * FammyComfort owns no credentials. The only sign-in path is `sso-handoff`: a
 * custom {@link ConvexCredentials} provider whose `authorize` trusts a Bytebazaar
 * handoff token. It verifies the token against the platform, upserts the org+user
 * into the local cache, consumes the token, and returns the resolved
 * `users._id` — Convex Auth then mints the session for that user. The client
 * triggers it with `signIn("sso-handoff", { token })` from the `/sso` route.
 *
 * Runtime is gated: `authorize` calls out to Bytebazaar via
 * `BYTEBAZAAR_CONVEX_URL` (throws `SSO_NOT_CONFIGURED` until set), and session
 * minting needs the deployment's auth keys (`JWT_PRIVATE_KEY`/`JWKS`/`SITE_URL`).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    ConvexCredentials({
      id: "sso-handoff",
      authorize: async (credentials, ctx) => {
        const token = credentials.token;
        if (typeof token !== "string" || token.length === 0) {
          return null; // malformed → sign-in fails cleanly
        }
        const { userId } = await resolveHandoff(ctx, token);
        return { userId };
      },
    }),
  ],
});
