import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { normPhone } from "./lib/demoPhone";
import {
  hashPassword,
  verifyPassword,
  assertPasswordStrength,
} from "./lib/password";
import { requireOrgUser } from "./lib/auth";
import { ensureOrgRoles } from "./rbac";

/**
 * Phone + password account flow (replaces the demo OTP). Users sign in with
 * their PHONE number — no usernames. On the very first login a user has no
 * password yet, so they set one (phone-only first login); afterwards it's phone
 * + password. Customers with an unknown phone self-register. Admins are NOT
 * reachable here (they use the email + password provider, same as before).
 *
 * The crypto (salt generation / hashing) lives in ACTIONS — the
 * `phone-password` provider's `authorize` in auth.ts, and `changePassword`
 * below. The internal mutations here only read/store the resulting hash string.
 */

/** All demo/phone accounts live in the single "demo" org (matches the prototype). */
async function demoOrg(ctx: {
  db: QueryCtx["db"];
}): Promise<Doc<"organizations">> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", "demo"))
    .unique();
  if (!org) throw new Error("Demo org missing — run devSeed:seedDemo first.");
  return org;
}

async function userByPhone(
  ctx: { db: QueryCtx["db"] },
  orgId: Id<"organizations">,
  phone: string,
): Promise<Doc<"users"> | null> {
  const needle = normPhone(phone);
  if (!needle) return null;
  const users = await ctx.db
    .query("users")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  return users.find((u) => u.phone && normPhone(u.phone) === needle) ?? null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Step 1 of the sign-in form: what does this phone need?
 *   "login"        → known account WITH a password → ask for password
 *   "set-password" → known account, NO password yet → first login, choose one
 *   "register"     → unknown phone → self-register (customer): name + password
 *   "blocked"      → admin or deactivated → not reachable via phone
 * Public (no auth): the sign-in screen calls it before any credential exists.
 * It reveals whether a phone is registered — acceptable (same as any OTP form).
 * ────────────────────────────────────────────────────────────────────────── */
export const phoneStatus = query({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    if (!normPhone(phone)) return { status: "register" as const };
    const org = await demoOrg(ctx);
    const user = await userByPhone(ctx, org._id, phone);
    if (!user) return { status: "register" as const };
    if (user.role === "admin" || !user.isActive) {
      return { status: "blocked" as const };
    }
    return {
      status: user.passwordHash ? ("login" as const) : ("set-password" as const),
      name: user.name,
    };
  },
});

/* ── Internal seams used by the `phone-password` provider (auth.ts) ── */

/** Resolve a phone to a user + their stored hash (or null). Internal-only. */
export const lookupForAuth = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const org = await demoOrg(ctx);
    const user = await userByPhone(ctx, org._id, phone);
    if (!user || user.role === "admin" || !user.isActive) return null;
    return {
      userId: user._id,
      hasPassword: Boolean(user.passwordHash),
      passwordHash: user.passwordHash ?? null,
    };
  },
});

/** Store a (already-hashed) password on a user. Internal-only. */
export const storePasswordHash = internalMutation({
  args: { userId: v.id("users"), passwordHash: v.string() },
  handler: async (ctx, { userId, passwordHash }) => {
    await ctx.db.patch(userId, { passwordHash, passwordSetAt: Date.now() });
  },
});

/** Create a self-registered customer (no password yet — caller stores the hash). */
export const createCustomer = internalMutation({
  args: { name: v.string(), phone: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { name, phone, email }) => {
    const org = await demoOrg(ctx);
    await ensureOrgRoles(ctx, org._id);
    if (name.trim().length < 3) throw new Error("Enter your full name.");
    if (!normPhone(phone)) throw new Error("Enter a valid phone number.");

    const existing = await userByPhone(ctx, org._id, phone);
    if (existing) return { userId: existing._id, created: false };

    const userId = await ctx.db.insert("users", {
      orgId: org._id,
      bytebazaarUserId: `demo:${normPhone(phone)}`,
      name: name.trim(),
      phone,
      email: email?.trim() || undefined,
      role: "customer",
      isActive: true,
      tier: "Bronze",
      points: 100, // welcome bonus
      stays: 0,
      vip: false,
    });
    await ctx.db.insert("guests", {
      orgId: org._id,
      fullName: name.trim(),
      phone,
      email: email?.trim() || undefined,
      consentAt: Date.now(),
    });
    await ctx.db.insert("auditLogs", {
      orgId: org._id,
      action: "account.register",
      entityType: "user",
      entityId: userId,
      after: { role: "customer", tier: "Bronze" },
    });
    return { userId, created: true };
  },
});

/* ── Self-service (authenticated): change password + edit profile ── */

/** Internal read used by `changePassword` (action) to fetch the current hash. */
export const myPasswordHash = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user ? { passwordHash: user.passwordHash ?? null } : null;
  },
});

/**
 * Change your own password. An ACTION (it hashes → needs randomness). Verifies
 * the current password first when one is set; if none is set (first-login left
 * it unset), it just sets the new one.
 */
export const changePassword = action({
  args: { currentPassword: v.optional(v.string()), newPassword: v.string() },
  handler: async (ctx, { currentPassword, newPassword }): Promise<{ ok: true }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in.");
    const userId = identity.subject.split("|")[0] as Id<"users">;

    assertPasswordStrength(newPassword);
    const record = await ctx.runQuery(internal.accounts.myPasswordHash, { userId });
    if (!record) throw new Error("Account not found.");
    if (record.passwordHash) {
      const ok = await verifyPassword(currentPassword ?? "", record.passwordHash);
      if (!ok) throw new Error("Current password is incorrect.");
    }
    const passwordHash = await hashPassword(newPassword);
    await ctx.runMutation(internal.accounts.storePasswordHash, { userId, passwordHash });
    return { ok: true };
  },
});

/** Update your own profile (name / email / phone). Phone must stay unique in-org. */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { name, email, phone }) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const patch: Partial<Doc<"users">> = {};

    if (name !== undefined) {
      if (name.trim().length < 3) throw new Error("Enter your full name.");
      patch.name = name.trim();
    }
    if (email !== undefined) patch.email = email.trim() || undefined;
    if (phone !== undefined) {
      if (!normPhone(phone)) throw new Error("Enter a valid phone number.");
      const clash = await userByPhone(ctx, orgId, phone);
      if (clash && clash._id !== user._id) {
        throw new Error("That phone number is already in use.");
      }
      patch.phone = phone;
    }
    if (Object.keys(patch).length === 0) return { changed: false };

    await ctx.db.patch(user._id, patch);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "account.update_profile",
      entityType: "user",
      entityId: user._id,
      after: patch,
    });
    return { changed: true };
  },
});