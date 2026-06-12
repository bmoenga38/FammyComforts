import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { resolveHandoff } from "./sso";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Convex injects `process.env` at runtime; the backend tsconfig has no Node types.
declare const process: { env: Record<string, string | undefined> };

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

    /**
     * DEMO phone + OTP (prototype parity, dev/demo tenants only). The OTP is
     * the fixed code in DEMO_OTP_CODE; providing `name` switches to the
     * registration flow (new customer, Bronze, +100 welcome points). Admins
     * are never reachable via phone (enforced in demoAuth.lookupByPhone).
     * Disabled entirely when DEMO_OTP_CODE is unset.
     */
    ConvexCredentials({
      id: "demo-otp",
      authorize: async (credentials, ctx) => {
        const code = process.env.DEMO_OTP_CODE;
        const { phone, otp, name, email } = credentials as {
          phone?: string;
          otp?: string;
          name?: string;
          email?: string;
        };
        if (!code || !phone || otp !== code) return null;
        if (name && name.trim().length > 0) {
          const res = (await ctx.runMutation(internal.demoAuth.registerCustomer, {
            name,
            phone,
            email,
          })) as { userId: Id<"users"> };
          return { userId: res.userId };
        }
        const res = (await ctx.runMutation(internal.demoAuth.lookupByPhone, {
          phone,
        })) as { found: boolean; userId?: Id<"users"> };
        if (!res.found || !res.userId) return null;
        return { userId: res.userId };
      },
    }),

    /**
     * DEMO admin email + password (DEMO_ADMIN_PASSWORD). Admin workspaces are
     * only reachable through this provider (or real SSO) — never phone OTP.
     */
    ConvexCredentials({
      id: "demo-admin",
      authorize: async (credentials, ctx) => {
        const pass = process.env.DEMO_ADMIN_PASSWORD;
        const { email, password } = credentials as { email?: string; password?: string };
        if (!pass || !email || password !== pass) return null;
        const res = (await ctx.runMutation(internal.demoAuth.lookupAdmin, {
          email,
        })) as { found: boolean; userId?: Id<"users"> };
        if (!res.found || !res.userId) return null;
        return { userId: res.userId };
      },
    }),
  ],
});
