import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { normPhone } from "./lib/demoPhone";
import { ensureOrgRoles } from "./rbac";

/**
 * DEV/DEMO authentication backing (mirrors the prototype's login exactly):
 * customers & staff sign in with phone + a fixed demo OTP; admins with email +
 * the demo password; unknown phones must register (→ customer, Bronze, +100
 * welcome points). All demo users live in the org with slug "demo". These are
 * internal mutations consumed by the `demo-otp` / `demo-admin` credentials
 * providers in convex/auth.ts. The production ByteAuth SSO path is untouched.
 */

async function demoOrg(ctx: MutationCtx): Promise<Doc<"organizations">> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", "demo"))
    .unique();
  if (!org) throw new Error("Demo org missing — run devSeed:seedDemo first.");
  return org;
}

async function userByPhone(
  ctx: MutationCtx,
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

/** Phone sign-in lookup. Admins are NOT reachable via phone (spec rule). */
export const lookupByPhone = internalMutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    const org = await demoOrg(ctx);
    const user = await userByPhone(ctx, org._id, phone);
    if (!user || user.role === "admin" || !user.isActive) {
      return { found: false as const };
    }
    return { found: true as const, userId: user._id, name: user.name, role: user.role };
  },
});

/** Registration: new customer (Bronze, +100 pts). Duplicate phone → sign-in. */
export const registerCustomer = internalMutation({
  args: {
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { name, phone, email }) => {
    const org = await demoOrg(ctx);
    if (!name.trim() || name.trim().length < 3) throw new Error("Enter your full name.");
    if (!normPhone(phone)) throw new Error("Enter a valid phone number.");

    const existing = await userByPhone(ctx, org._id, phone);
    if (existing) {
      if (existing.role === "admin" || !existing.isActive) {
        throw new Error("This number cannot be used here.");
      }
      return { userId: existing._id, created: false }; // fall back to sign-in
    }
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
    await ctx.db.insert("auditLogs", {
      orgId: org._id,
      action: "demo.register",
      entityType: "user",
      entityId: userId,
      after: { role: "customer", tier: "Bronze" },
    });
    return { userId, created: true };
  },
});

/** Admin sign-in lookup (email, case-insensitive; admins only). */
export const lookupAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const org = await demoOrg(ctx);
    const needle = email.trim().toLowerCase();
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const admin = users.find(
      (u) => u.role === "admin" && u.isActive && (u.email ?? "").toLowerCase() === needle,
    );
    return admin ? { found: true as const, userId: admin._id } : { found: false as const };
  },
});

/* ── The 12 seed users (dev & demo testers) ── */
type SeedUser = {
  name: string;
  phone: string;
  email?: string;
  role: "admin" | "reception" | "operations" | "assistant" | "customer";
  shift?: string;
  tier?: string;
  points?: number;
  stays?: number;
  vip?: boolean;
};

const SEED_USERS: SeedUser[] = [
  { name: "Stella Ireri", phone: "+254786975525", email: "stella.ireri@fammycomforts.co.ke", role: "admin" },
  { name: "Brian Moenga", phone: "+254792697197", email: "brian.moenga@fammycomforts.co.ke", role: "admin" },
  { name: "Grace Achieng", phone: "+254711203040", role: "reception", shift: "Morning" },
  { name: "Kevin Omondi", phone: "+254722305060", role: "reception", shift: "Evening" },
  { name: "Dennis Kiprotich", phone: "+254733407080", role: "operations", shift: "Full day" },
  { name: "Mercy Wanjala", phone: "+254740509010", role: "assistant", shift: "Morning" },
  { name: "Collins Mutua", phone: "+254757611213", role: "assistant", shift: "Evening" },
  { name: "Janet Nyambura", phone: "+254712814151", email: "janet.nyam@gmail.com", role: "customer", tier: "Platinum", points: 5200, stays: 28, vip: true },
  { name: "Eric Ochieng", phone: "+254723916171", email: "eric.ochieng@yahoo.com", role: "customer", tier: "Gold", points: 2100, stays: 10, vip: false },
  { name: "Amina Yusuf", phone: "+254701018192", email: "amina.yusuf@outlook.com", role: "customer", tier: "Silver", points: 750, stays: 4, vip: false },
  { name: "Kelvin Mwenda", phone: "+254768120212", email: "kelvin.mwenda@gmail.com", role: "customer", tier: "Bronze", points: 150, stays: 1, vip: false },
  { name: "Diana Cherop", phone: "+254779222324", role: "customer", tier: "Bronze", points: 100, stays: 0, vip: false },
];

/** Demo role → RBAC base role (seeded per-org by ensureOrgRoles). */
const ROLE_TO_BASE: Record<string, string | null> = {
  admin: "Property Admin",
  reception: "Receptionist",
  operations: "Operations Manager",
  assistant: "Housekeeping",
  customer: null,
};

/** Idempotent: skips any user whose phone already exists in the demo org. */
export const seedDemoUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const org = await demoOrg(ctx);
    await ensureOrgRoles(ctx, org._id);
    let created = 0;
    let skipped = 0;

    for (const u of SEED_USERS) {
      if (await userByPhone(ctx, org._id, u.phone)) {
        skipped++;
        continue;
      }
      const userId = await ctx.db.insert("users", {
        orgId: org._id,
        bytebazaarUserId: `demo:${normPhone(u.phone)}`,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
        isActive: true,
        tier: u.tier,
        points: u.points,
        stays: u.stays,
        vip: u.vip,
        shift: u.shift,
      });
      const baseRole = ROLE_TO_BASE[u.role];
      if (baseRole) {
        const role = await ctx.db
          .query("roles")
          .withIndex("by_org_name", (q) => q.eq("orgId", org._id).eq("name", baseRole))
          .unique();
        if (role) {
          await ctx.db.insert("userRoles", { orgId: org._id, userId, roleId: role._id });
        }
      }
      // Customers also get a guests row so desk lookup/bookings link to them.
      if (u.role === "customer") {
        await ctx.db.insert("guests", {
          orgId: org._id,
          fullName: u.name,
          phone: u.phone,
          email: u.email,
          consentAt: Date.now(),
        });
      }
      created++;
    }
    return { created, skipped };
  },
});
