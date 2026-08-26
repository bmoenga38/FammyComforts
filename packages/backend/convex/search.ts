import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrgUser, resolvePermissions } from "./lib/auth";

/**
 * Global staff search (top-bar) — one query across rooms, guests, and bookings,
 * org-scoped and permission-aware. Rooms are readable by any org member (the
 * open operational-read policy); guests and bookings are only searched when the
 * caller holds `Guests:read` / `Bookings:read`. Returns a small capped set per
 * category for a fast dropdown. Empty/short queries return nothing.
 */
const PER_CATEGORY = 6;

export const global = query({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const needle = text.trim().toLowerCase();
    if (needle.length < 2) {
      return { rooms: [], guests: [], bookings: [] };
    }
    const perms = await resolvePermissions(ctx, user, orgId);
    const digits = needle.replace(/\D/g, "");

    // Rooms (open read) — match number or type name.
    const allRooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const roomHits = [];
    for (const r of allRooms) {
      const type = await ctx.db.get(r.roomTypeId);
      const typeName = type?.name ?? "";
      if (
        r.number.toLowerCase().includes(needle) ||
        typeName.toLowerCase().includes(needle)
      ) {
        roomHits.push({
          roomId: r._id,
          number: r.number,
          typeName,
          status: r.status,
        });
      }
      if (roomHits.length >= PER_CATEGORY) break;
    }

    // Guests (Guests:read) — match name / phone / email.
    const guestHits: {
      guestId: string;
      fullName: string;
      phone: string;
      email: string | null;
    }[] = [];
    if (perms.has("Guests:read")) {
      const guests = await ctx.db
        .query("guests")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const g of guests) {
        if (
          g.fullName.toLowerCase().includes(needle) ||
          (digits.length >= 3 && g.phone.replace(/\D/g, "").includes(digits)) ||
          (g.email ?? "").toLowerCase().includes(needle)
        ) {
          guestHits.push({
            guestId: g._id,
            fullName: g.fullName,
            phone: g.phone,
            email: g.email ?? null,
          });
        }
        if (guestHits.length >= PER_CATEGORY) break;
      }
    }

    // Bookings (Bookings:read) — match reference or guest name.
    const bookingHits: {
      bookingId: string;
      reference: string;
      guestName: string;
      roomNumber: string | null;
      checkInDate: string;
      checkOutDate: string;
      status: string;
    }[] = [];
    if (perms.has("Bookings:read")) {
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .collect();
      for (const b of bookings) {
        const guest = await ctx.db.get(b.guestId);
        const guestName = guest?.fullName ?? "";
        if (
          b.reference.toLowerCase().includes(needle) ||
          guestName.toLowerCase().includes(needle)
        ) {
          const room = await ctx.db.get(b.roomId);
          bookingHits.push({
            bookingId: b._id,
            reference: b.reference,
            guestName,
            roomNumber: room?.number ?? null,
            checkInDate: b.checkInDate,
            checkOutDate: b.checkOutDate,
            status: b.status,
          });
        }
        if (bookingHits.length >= PER_CATEGORY) break;
      }
    }

    return { rooms: roomHits, guests: guestHits, bookings: bookingHits };
  },
});
