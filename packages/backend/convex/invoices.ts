import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/**
 * Invoices & receipts (Story 5.6). Line items are SNAPSHOTTED from the ledger
 * at generation time so a document can never drift from what it billed:
 * an invoice captures the charges/adjustments; a receipt captures the confirmed
 * payments. PDF: documents render on a print-optimized web view (browser
 * print-to-PDF) — server-side rendering is deferred (no headless renderer in
 * the Convex runtime); documented variance from NFR9.
 */

export const generate = mutation({
  args: { bookingId: v.id("bookings"), isReceipt: v.boolean() },
  handler: async (ctx, { bookingId, isReceipt }) => {
    const { user, orgId } = await requirePermission(ctx, "Payments", "write");
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.orgId !== orgId) {
      throw new Error("Booking not found in this organization.");
    }
    const entries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();

    // Invoice = positive entries (charges/adjustments); receipt = payments
    // (shown positive on the document).
    const lines = entries
      .filter((e) =>
        isReceipt
          ? e.type === "payment" || e.type === "refund"
          : e.type === "charge" || e.type === "adjustment",
      )
      .map((e) => ({
        description: e.memo ?? e.type,
        amountCents: e.amountCents < 0n ? -e.amountCents : e.amountCents,
      }));
    if (lines.length === 0) {
      throw new Error(
        isReceipt ? "No payments to receipt yet." : "No charges to invoice yet.",
      );
    }
    let totalCents = 0n;
    for (const l of lines) totalCents += l.amountCents;

    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
    const number = `${isReceipt ? "RCT" : "INV"}-${booking.reference.replace("BK-", "")}-${
      existing.length + 1
    }`;

    const invoiceId = await ctx.db.insert("invoices", {
      orgId,
      bookingId,
      number,
      isReceipt,
      totalCents,
      currency: booking.currency,
      lines,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: isReceipt ? "receipt.generate" : "invoice.generate",
      entityType: "invoice",
      entityId: invoiceId,
      after: { number, totalCents },
    });
    return { invoiceId, number, totalCents };
  },
});

/** Staff list for one booking. */
export const forBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const { orgId } = await requirePermission(ctx, "Payments", "read");
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.orgId !== orgId) return [];
    return await ctx.db
      .query("invoices")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
  },
});
