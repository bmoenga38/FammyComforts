import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { resolveHandoff } from "./sso";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashPassword, verifyPassword, assertPasswordStrength } from "./lib/password";

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
     * Phone + password (staff & customers). The phone number is the identity —
     * no usernames. Three modes (the client picks one after `accounts.phoneStatus`):
     *   - "login":        existing account → verify password.
     *   - "set-password": existing account with no password yet (phone-only
     *                     FIRST login) → set the chosen password, then sign in.
     *   - "register":     unknown phone → create a customer, set password, sign in.
     * Admins are never reachable here (enforced in accounts.lookupForAuth /
     * createCustomer); they use the `demo-admin` email + password provider.
     */
    ConvexCredentials({
      id: "phone-password",
      authorize: async (credentials, ctx) => {
        const { mode, phone, password, name, email } = credentials as {
          mode?: "login" | "set-password" | "register";
          phone?: string;
          password?: string;
          name?: string;
          email?: string;
        };
        if (!phone || !password) return null;

        if (mode === "register") {
          assertPasswordStrength(password);
          const res = (await ctx.runMutation(internal.accounts.createCustomer, {
            name: name ?? "",
            phone,
            email,
          })) as { userId: Id<"users">; created: boolean };
          const passwordHash = await hashPassword(password);
          await ctx.runMutation(internal.accounts.storePasswordHash, {
            userId: res.userId,
            passwordHash,
          });
          return { userId: res.userId };
        }

        const record = (await ctx.runQuery(internal.accounts.lookupForAuth, {
          phone,
        })) as { userId: Id<"users">; hasPassword: boolean; passwordHash: string | null } | null;
        if (!record) return null;

        if (mode === "set-password") {
          // First login only — refuse if a password already exists.
          if (record.hasPassword) return null;
          assertPasswordStrength(password);
          const passwordHash = await hashPassword(password);
          await ctx.runMutation(internal.accounts.storePasswordHash, {
            userId: record.userId,
            passwordHash,
          });
          return { userId: record.userId };
        }

        // Default: normal login.
        if (!record.passwordHash) return null;
        const ok = await verifyPassword(password, record.passwordHash);
        return ok ? { userId: record.userId } : null;
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
