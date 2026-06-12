import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/**
 * Guest requests from the portal (Story 5.7). PUBLIC submit is verified the
 * same way as lookup (reference + matching contact); staff see and resolve the
 * queue (the full operations workspace is R2 — this is the R1 surface).
 */

export const submit = mutation({
  args: { reference: v.string(), contact: v.string(), message: v.string() },
  handler: async (ctx, { reference, contact, message }) => {
    const trimmed = message.trim();
    if (!trimmed) throw new Error("Request message is required.");
    if (trimmed.length > 1000) throw new Error("Request is too long (max 1000 chars).");

    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) =>
        q.eq("reference", reference.trim().toUpperCase()),
      )
      .unique();
    if (!booking) throw new Error("Booking not found.");
    const guest = await ctx.db.get(booking.guestId);
    const needle = contact.trim().toLowerCase();
    if (
      !guest ||
      (guest.phone.toLowerCase() !== needle &&
        (guest.email ?? "").toLowerCase() !== needle)
    ) {
      throw new Error("Booking not found."); // no enumeration
    }

    const requestId = await ctx.db.insert("guestRequests", {
      orgId: booking.orgId,
      bookingId: booking._id,
      message: trimmed,
      status: "open",
    });
    await ctx.db.insert("auditLogs", {
      orgId: booking.orgId,
      action: "guestRequest.submit",
      entityType: "guestRequest",
      entityId: requestId,
      after: { bookingReference: booking.reference },
    });
    return { requestId };
  },
});

/** Staff queue (Bookings:read) — open first. */
export const listForOrg = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Bookings", "read");
    const rows = await ctx.db
      .query("guestRequests")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
    const out = [];
    for (const r of rows) {
      const booking = await ctx.db.get(r.bookingId);
      out.push({
        requestId: r._id,
        message: r.message,
        status: r.status,
        bookingReference: booking?.reference ?? null,
        createdAt: r._creationTime,
      });
    }
    return out.sort((a, b) =>
      a.status === b.status ? b.createdAt - a.createdAt : a.status === "open" ? -1 : 1,
    );
  },
});

export const resolve = mutation({
  args: { requestId: v.id("guestRequests") },
  handler: async (ctx, { requestId }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const request = await ctx.db.get(requestId);
    if (!request || request.orgId !== orgId) {
      throw new Error("Request not found in this organization.");
    }
    if (request.status === "resolved") return { changed: false };
    await ctx.db.patch(requestId, { status: "resolved" });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "guestRequest.resolve",
      entityType: "guestRequest",
      entityId: requestId,
    });
    return { changed: true };
  },
});
