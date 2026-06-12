import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { postLedgerEntry, bookingBalanceCents } from "./lib/ledger";
import { enabledMethodsFor } from "./paymentMethods";

/**
 * Manual payment recording + reconciliation (Stories 5.5 + 5.8). Manual
 * entries post to the ledger immediately as confirmed but `reconciled: false`
 * so the reconciliation view can match them against statements later.
 */

/** Record an offline payment: manual M-Pesa reference, cash, or card. */
export const recordManual = mutation({
  args: {
    bookingId: v.id("bookings"),
    provider: v.union(
      v.literal("mpesa_manual"),
      v.literal("cash"),
      v.literal("card"),
    ),
    amountCents: v.int64(),
    receiptNumber: v.optional(v.string()), // required for mpesa_manual
    paidPhone: v.optional(v.string()),
  },
  handler: async (ctx, { bookingId, provider, amountCents, receiptNumber, paidPhone }) => {
    const { user, orgId } = await requirePermission(ctx, "Payments", "write");
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.orgId !== orgId) {
      throw new Error("Booking not found in this organization.");
    }
    if (amountCents <= 0n) throw new Error("Amount must be positive.");
    if (!(await enabledMethodsFor(ctx, orgId)).includes(provider)) {
      throw new Error(`${provider} is disabled for this property.`);
    }
    if (provider === "mpesa_manual") {
      const code = receiptNumber?.trim().toUpperCase();
      if (!code) throw new Error("An M-Pesa receipt code is required.");
      // Dedupe confirmed receipts (no unique constraint — index read in-tx).
      const dupe = await ctx.db
        .query("payments")
        .withIndex("by_receipt", (q) => q.eq("providerReceiptNumber", code))
        .first();
      if (dupe) throw new Error(`Receipt ${code} is already recorded.`);
      receiptNumber = code;
    }

    const paymentId = await ctx.db.insert("payments", {
      orgId,
      bookingId,
      provider,
      status: "confirmed",
      amountCents,
      currency: booking.currency,
      providerReceiptNumber: receiptNumber,
      paidPhone,
      paidAt: Date.now(),
      reconciled: false, // flagged for Story 5.8
    });
    await postLedgerEntry(ctx, {
      orgId,
      bookingId,
      type: "payment",
      amountCents: -amountCents,
      currency: booking.currency,
      memo: `${provider}${receiptNumber ? ` ${receiptNumber}` : ""}`,
      paymentId,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "payment.record_manual",
      entityType: "payment",
      entityId: paymentId,
      after: { provider, amountCents, receiptNumber: receiptNumber ?? null, bookingId },
    });
    return {
      paymentId,
      balanceCents: await bookingBalanceCents(ctx, bookingId),
    };
  },
});

/** Payments + ledger + derived balance for one booking (staff). */
export const forBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const { orgId } = await requirePermission(ctx, "Payments", "read");
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.orgId !== orgId) return null;
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
    const ledger = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
    return {
      payments,
      ledger,
      balanceCents: await bookingBalanceCents(ctx, bookingId),
    };
  },
});

/**
 * Reconciliation worklist (Story 5.8): unreconciled payments, with mismatch
 * flags surfaced. Gated by Payments:read; resolving needs Payments:manage.
 */
export const reconciliationList = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Payments", "read");
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_org_reconciled", (q) => q.eq("orgId", orgId).eq("reconciled", false))
      .collect();
    const out = [];
    for (const p of rows) {
      const booking = p.bookingId ? await ctx.db.get(p.bookingId) : null;
      out.push({
        paymentId: p._id,
        provider: p.provider,
        status: p.status,
        amountCents: p.amountCents,
        receiptNumber: p.providerReceiptNumber ?? null,
        bookingReference: booking?.reference ?? null,
        amountMismatch: p.amountMismatch ?? false,
        paidAt: p.paidAt ?? null,
      });
    }
    return out;
  },
});

/** Mark a payment reconciled (audited). */
export const resolveReconciliation = mutation({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, { paymentId }) => {
    const { user, orgId } = await requirePermission(ctx, "Payments", "manage");
    const payment = await ctx.db.get(paymentId);
    if (!payment || payment.orgId !== orgId) {
      throw new Error("Payment not found in this organization.");
    }
    if (payment.reconciled) return { changed: false };
    await ctx.db.patch(paymentId, { reconciled: true });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "payment.reconcile",
      entityType: "payment",
      entityId: paymentId,
      after: { reconciled: true },
    });
    return { changed: true };
  },
});
