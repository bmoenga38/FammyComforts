import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  orgBySlug,
  activeRatePlan,
  activeTaxBps,
  assertDateRange,
  nightsBetween,
  hasConflict,
  priceStay,
} from "./lib/bookingDomain";
import { postLedgerEntry, bookingBalanceCents } from "./lib/ledger";
import { enabledMethodsFor } from "./paymentMethods";

/**
 * PUBLIC no-account booking (Stories 4.4–4.8). The tenant comes from the org
 * slug; the create mutation re-checks availability transactionally (Convex
 * mutations are serializable, so two guests cannot double-book a room). Payment
 * here is INTENT only — processing is Epic 5.
 */

const PAYMENT_METHOD = v.union(
  v.literal("mpesa_stk"),
  v.literal("mpesa_manual"),
  v.literal("cash"),
  v.literal("card"),
);

// Unambiguous reference alphabet (no 0/O/1/I).
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function uniqueReference(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
    }
    const reference = `BK-${code}`;
    const clash = await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    if (!clash) return reference;
  }
  throw new Error("Could not generate a booking reference — please retry.");
}

/** Signed upload URL for optional ID images (Story 4.5). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const create = mutation({
  args: {
    orgSlug: v.string(),
    roomId: v.id("rooms"),
    checkInDate: v.string(),
    checkOutDate: v.string(),
    guest: v.object({
      fullName: v.string(),
      phone: v.string(),
      email: v.optional(v.string()),
      dob: v.optional(v.string()),
      nationality: v.optional(v.string()),
      idType: v.optional(v.string()),
      idNumber: v.optional(v.string()),
    }),
    consent: v.boolean(),
    paymentMethod: PAYMENT_METHOD,
    paymentSplits: v.optional(
      v.array(v.object({ method: PAYMENT_METHOD, amountCents: v.int64() })),
    ),
    documents: v.optional(
      v.array(
        v.object({
          kind: v.union(v.literal("id_front"), v.literal("id_back")),
          storageId: v.id("_storage"),
        }),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await orgBySlug(ctx, args.orgSlug);

    // Required consent + identity basics (Story 4.4 negative AC).
    if (!args.consent) throw new Error("Consent is required to book.");
    if (!args.guest.fullName.trim()) throw new Error("Full name is required.");
    if (!args.guest.phone.trim()) throw new Error("Phone number is required.");

    // Dates: valid range, and online bookings cannot start in the past.
    assertDateRange(args.checkInDate, args.checkOutDate);
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (args.checkInDate < todayUtc) {
      throw new Error("Check-in date cannot be in the past.");
    }

    // Payment-method intent must be one the property enabled (Story 5.1).
    if (!(await enabledMethodsFor(ctx, org._id)).includes(args.paymentMethod)) {
      throw new Error("That payment method is not available at this property.");
    }

    // Room must be this tenant's, operational, and priced.
    const room = await ctx.db.get(args.roomId);
    if (!room || room.orgId !== org._id) throw new Error("Room not found.");
    if (room.status === "maintenance" || room.status === "blocked") {
      throw new Error("This room is not currently bookable.");
    }
    const plan = await activeRatePlan(ctx, org._id, room.roomTypeId);
    if (!plan) throw new Error("This room is not currently bookable online.");

    // Transactional availability re-check (race-safe under Convex).
    if (await hasConflict(ctx, args.roomId, args.checkInDate, args.checkOutDate)) {
      throw new Error("This room is no longer available for those dates.");
    }

    // Exact integer-cents pricing (NFR14).
    const nights = nightsBetween(args.checkInDate, args.checkOutDate);
    const { totalCents } = priceStay(
      plan.nightlyCents,
      nights,
      await activeTaxBps(ctx, org._id),
    );

    // Split intent must be positive amounts that don't exceed the total.
    if (args.paymentSplits) {
      let sum = 0n;
      for (const s of args.paymentSplits) {
        if (s.amountCents <= 0n) throw new Error("Split amounts must be positive.");
        sum += s.amountCents;
      }
      if (sum > totalCents) {
        throw new Error("Split amounts exceed the booking total.");
      }
    }

    const guestId = await ctx.db.insert("guests", {
      orgId: org._id,
      ...args.guest,
      consentAt: Date.now(),
    });
    const reference = await uniqueReference(ctx);
    const bookingId = await ctx.db.insert("bookings", {
      orgId: org._id,
      reference,
      guestId,
      roomId: args.roomId,
      ratePlanId: plan._id,
      checkInDate: args.checkInDate,
      checkOutDate: args.checkOutDate,
      status: "pending",
      source: "website",
      notes: args.notes,
      expectedTotalCents: totalCents,
      currency: plan.currency,
      paymentMethod: args.paymentMethod,
      paymentSplits: args.paymentSplits,
    });

    // Initialize the ledger with the expected-stay charge (Story 5.2): the
    // balance is derived from entries from day one, never hand-set.
    await postLedgerEntry(ctx, {
      orgId: org._id,
      bookingId,
      type: "charge",
      amountCents: totalCents,
      currency: plan.currency,
      memo: `Stay ${args.checkInDate} → ${args.checkOutDate} (${nights} nights, tax incl.)`,
    });

    for (const doc of args.documents ?? []) {
      await ctx.db.insert("guestDocuments", {
        orgId: org._id,
        guestId,
        bookingId,
        kind: doc.kind,
        storageId: doc.storageId,
      });
    }

    // Queue the confirmation on every channel the property enabled (Story 4.7).
    const settings = await ctx.db
      .query("notificationSettings")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    for (const s of settings) {
      if (s.type === "booking_confirmation" && s.enabled) {
        await ctx.db.insert("outboundNotifications", {
          orgId: org._id,
          type: "booking_confirmation",
          channel: s.channel,
          bookingId,
          status: "queued",
        });
      }
    }

    // Audit — public actor; never include idNumber or other sensitive fields.
    await ctx.db.insert("auditLogs", {
      orgId: org._id,
      action: "booking.create",
      entityType: "booking",
      entityId: bookingId,
      after: {
        reference,
        roomNumber: room.number,
        checkInDate: args.checkInDate,
        checkOutDate: args.checkOutDate,
        expectedTotalCents: totalCents,
        source: "website",
      },
    });

    return {
      bookingId,
      reference,
      status: "pending" as const,
      nights,
      expectedTotalCents: totalCents,
      currency: plan.currency,
    };
  },
});

/**
 * Public booking lookup (Story 4.8): reference PLUS a matching phone or email —
 * the contact requirement prevents reference enumeration. Returns a guest-safe
 * view only (no idNumber, no internal ids).
 */
export const lookup = query({
  args: { reference: v.string(), contact: v.string() },
  handler: async (ctx, { reference, contact }) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) => q.eq("reference", reference.trim().toUpperCase()))
      .unique();
    if (!booking) return null;

    const guest = await ctx.db.get(booking.guestId);
    if (!guest) return null;
    const needle = contact.trim().toLowerCase();
    const matches =
      needle.length > 0 &&
      (guest.phone.toLowerCase() === needle ||
        (guest.email ?? "").toLowerCase() === needle);
    if (!matches) return null; // same response as not-found — no enumeration

    const room = await ctx.db.get(booking.roomId);
    const type = room ? await ctx.db.get(room.roomTypeId) : null;
    const org = await ctx.db.get(booking.orgId);

    return {
      reference: booking.reference,
      status: booking.status,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      roomNumber: room?.number ?? null,
      roomType: type?.name ?? null,
      propertyName: org?.name ?? null,
      guestName: guest.fullName,
      expectedTotalCents: booking.expectedTotalCents,
      // Derived from the ledger (Story 5.2) — charges minus confirmed payments.
      balanceCents: await bookingBalanceCents(ctx, booking._id),
      currency: booking.currency,
      paymentMethod: booking.paymentMethod,
    };
  },
});

/**
 * Guest portal data (Story 5.7): the verified lookup plus payments, invoices,
 * and open requests — everything the lightweight portal renders. Same
 * anti-enumeration contract as `lookup` (null unless reference + contact match).
 */
export const portal = query({
  args: { reference: v.string(), contact: v.string() },
  handler: async (ctx, { reference, contact }) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_reference", (q) =>
        q.eq("reference", reference.trim().toUpperCase()),
      )
      .unique();
    if (!booking) return null;
    const guest = await ctx.db.get(booking.guestId);
    const needle = contact.trim().toLowerCase();
    if (
      !guest ||
      needle.length === 0 ||
      (guest.phone.toLowerCase() !== needle &&
        (guest.email ?? "").toLowerCase() !== needle)
    ) {
      return null;
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .collect();
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .collect();
    const requests = await ctx.db
      .query("guestRequests")
      .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
      .collect();
    const room = await ctx.db.get(booking.roomId);
    const type = room ? await ctx.db.get(room.roomTypeId) : null;
    const org = await ctx.db.get(booking.orgId);

    return {
      reference: booking.reference,
      status: booking.status,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      roomNumber: room?.number ?? null,
      roomType: type?.name ?? null,
      propertyName: org?.name ?? null,
      guestName: guest.fullName,
      currency: booking.currency,
      expectedTotalCents: booking.expectedTotalCents,
      balanceCents: await bookingBalanceCents(ctx, booking._id),
      payments: payments.map((p) => ({
        provider: p.provider,
        status: p.status,
        amountCents: p.amountCents,
        receiptNumber: p.providerReceiptNumber ?? null,
        paidAt: p.paidAt ?? null,
      })),
      invoices: invoices.map((i) => ({
        invoiceId: i._id,
        number: i.number,
        isReceipt: i.isReceipt,
        totalCents: i.totalCents,
        lines: i.lines,
      })),
      requests: requests.map((r) => ({
        message: r.message,
        status: r.status,
        createdAt: r._creationTime,
      })),
    };
  },
});
