import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/**
 * Guest profile management (Story 6.2) — "Guests" area. Profiles are created
 * by Epic 4 public bookings or here at the desk; this adds staff CRUD plus the
 * repeat-guest stats (booking count + total spent from confirmed payments).
 * idNumber is visible to Guests:read staff (front desk verifies identity) but
 * never leaves staff surfaces.
 */

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    const { orgId } = await requirePermission(ctx, "Guests", "read");
    let guests = await ctx.db
      .query("guests")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    if (search?.trim()) {
      const needle = search.trim().toLowerCase();
      guests = guests.filter(
        (g) =>
          g.fullName.toLowerCase().includes(needle) ||
          g.phone.includes(needle) ||
          (g.email ?? "").toLowerCase().includes(needle),
      );
    }
    const out = [];
    for (const g of guests) {
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_guest", (q) => q.eq("guestId", g._id))
        .collect();
      let totalSpentCents = 0n;
      for (const b of bookings) {
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_booking", (q) => q.eq("bookingId", b._id))
          .collect();
        for (const p of payments) {
          if (p.status === "confirmed") totalSpentCents += p.amountCents;
        }
      }
      out.push({
        guestId: g._id,
        fullName: g.fullName,
        phone: g.phone,
        email: g.email ?? null,
        nationality: g.nationality ?? null,
        idType: g.idType ?? null,
        idNumber: g.idNumber ?? null,
        bookingCount: bookings.length,
        totalSpentCents,
      });
    }
    return out.sort((a, b) => b.bookingCount - a.bookingCount);
  },
});

export const create = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    dob: v.optional(v.string()),
    nationality: v.optional(v.string()),
    idType: v.optional(v.string()),
    idNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Guests", "write");
    if (!args.fullName.trim()) throw new Error("Full name is required.");
    if (!args.phone.trim()) throw new Error("Phone is required.");
    const guestId = await ctx.db.insert("guests", {
      orgId,
      ...args,
      consentAt: Date.now(), // staff-entered profile; consent captured at desk
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "guest.create",
      entityType: "guest",
      entityId: guestId,
      after: { fullName: args.fullName }, // never audit id numbers
    });
    return guestId;
  },
});

export const update = mutation({
  args: {
    guestId: v.id("guests"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    dob: v.optional(v.string()),
    nationality: v.optional(v.string()),
    idType: v.optional(v.string()),
    idNumber: v.optional(v.string()),
  },
  handler: async (ctx, { guestId, ...patch }) => {
    const { user, orgId } = await requirePermission(ctx, "Guests", "write");
    const guest = await ctx.db.get(guestId);
    if (!guest || guest.orgId !== orgId) {
      throw new Error("Guest not found in this organization.");
    }
    await ctx.db.patch(guestId, patch);
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "guest.update",
      entityType: "guest",
      entityId: guestId,
      after: { fields: Object.keys(patch) }, // field names only — no ID values
    });
    return { changed: true };
  },
});
