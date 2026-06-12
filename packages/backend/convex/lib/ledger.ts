import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * The shared money engine (Story 5.2, NFR14/AR5). All amounts are int64 cents;
 * the booking balance is DERIVED — the signed sum of its ledger entries
 * (charge/adjustment positive, payment/refund negative) — and never hand-edited.
 */

export async function bookingBalanceCents(
  ctx: QueryCtx,
  bookingId: Id<"bookings">,
): Promise<bigint> {
  const entries = await ctx.db
    .query("ledgerEntries")
    .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
    .collect();
  let balance = 0n;
  for (const e of entries) balance += e.amountCents;
  return balance;
}

export async function postLedgerEntry(
  ctx: MutationCtx,
  entry: {
    orgId: Id<"organizations">;
    bookingId: Id<"bookings">;
    type: "charge" | "payment" | "refund" | "adjustment";
    amountCents: bigint; // signed per convention
    currency: string;
    memo?: string;
    paymentId?: Id<"payments">;
  },
): Promise<Id<"ledgerEntries">> {
  // Enforce the sign convention so a mis-signed call can't corrupt balances.
  if (
    (entry.type === "charge" || entry.type === "adjustment") &&
    entry.amountCents <= 0n &&
    entry.type === "charge"
  ) {
    throw new Error("Charges must be positive.");
  }
  if ((entry.type === "payment" || entry.type === "refund") && entry.amountCents >= 0n) {
    throw new Error("Payments/refunds must be negative (they reduce the balance).");
  }
  return await ctx.db.insert("ledgerEntries", entry);
}
