import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import {
  assertDateRange,
  nightsBetween,
  hasConflict,
  activeRatePlan,
  activeTaxBps,
  priceStay,
} from "./lib/bookingDomain";
import { postLedgerEntry, bookingBalanceCents } from "./lib/ledger";
import { enabledMethodsFor } from "./paymentMethods";

/**
 * Front-desk booking operations (Epic 6) — "Bookings" area, all audited, all
 * money through the Epic 5 ledger. Lifecycle: pending → confirmed → checked_in
 * → checked_out (or cancelled / no_show). Room status follows check-in/out.
 */

const ACTIVE = new Set(["pending", "confirmed", "checked_in"]);

async function getOrgBooking(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  bookingId: Id<"bookings">,
): Promise<Doc<"bookings">> {
  const booking = await ctx.db.get(bookingId);
  if (!booking || booking.orgId !== orgId) {
    throw new Error("Booking not found in this organization.");
  }
  return booking;
}

// Reference generation (same contract as guest bookings).
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ---------- Story 6.1: desk create + edit ----------

export const create = mutation({
  args: {
    roomId: v.id("rooms"),
    checkInDate: v.string(),
    checkOutDate: v.string(),
    guestId: v.optional(v.id("guests")),
    newGuest: v.optional(
      v.object({
        fullName: v.string(),
        phone: v.string(),
        email: v.optional(v.string()),
        idType: v.optional(v.string()),
        idNumber: v.optional(v.string()),
      }),
    ),
    source: v.union(
      v.literal("direct"),
      v.literal("walk_in"),
      v.literal("ota"),
      v.literal("agent"),
      v.literal("phone"),
      v.literal("whatsapp"),
    ),
    paymentMethod: v.union(
      v.literal("mpesa_stk"),
      v.literal("mpesa_manual"),
      v.literal("cash"),
      v.literal("card"),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    assertDateRange(args.checkInDate, args.checkOutDate);
    if (!(await enabledMethodsFor(ctx, orgId)).includes(args.paymentMethod)) {
      throw new Error("That payment method is disabled for this property.");
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.orgId !== orgId) throw new Error("Room not found.");
    if (room.status === "maintenance" || room.status === "blocked") {
      throw new Error("This room is not currently bookable.");
    }
    const plan = await activeRatePlan(ctx, orgId, room.roomTypeId);
    if (!plan) throw new Error("This room's type has no active rate plan.");
    if (await hasConflict(ctx, args.roomId, args.checkInDate, args.checkOutDate)) {
      throw new Error("This room is not available for those dates.");
    }

    // Guest: existing profile or inline create (Story 6.2 link).
    let guestId = args.guestId;
    if (!guestId) {
      if (!args.newGuest?.fullName.trim() || !args.newGuest.phone.trim()) {
        throw new Error("Select a guest or provide a name and phone.");
      }
      guestId = await ctx.db.insert("guests", {
        orgId,
        ...args.newGuest,
        consentAt: Date.now(),
      });
    } else {
      const guest = await ctx.db.get(guestId);
      if (!guest || guest.orgId !== orgId) throw new Error("Guest not found.");
    }

    const nights = nightsBetween(args.checkInDate, args.checkOutDate);
    const { totalCents } = priceStay(
      plan.nightlyCents,
      nights,
      await activeTaxBps(ctx, orgId),
    );

    let reference = "";
    for (let attempt = 0; attempt < 8 && !reference; attempt++) {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
      }
      const candidate = `BK-${code}`;
      const clash = await ctx.db
        .query("bookings")
        .withIndex("by_reference", (q) => q.eq("reference", candidate))
        .unique();
      if (!clash) reference = candidate;
    }
    if (!reference) throw new Error("Could not generate a reference — retry.");

    const bookingId = await ctx.db.insert("bookings", {
      orgId,
      reference,
      guestId,
      roomId: args.roomId,
      ratePlanId: plan._id,
      checkInDate: args.checkInDate,
      checkOutDate: args.checkOutDate,
      status: "confirmed", // desk bookings are confirmed directly
      source: args.source,
      notes: args.notes,
      expectedTotalCents: totalCents,
      currency: plan.currency,
      paymentMethod: args.paymentMethod,
    });
    await postLedgerEntry(ctx, {
      orgId,
      bookingId,
      type: "charge",
      amountCents: totalCents,
      currency: plan.currency,
      memo: `Stay ${args.checkInDate} → ${args.checkOutDate} (${nights} nights, tax incl.)`,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.desk_create",
      entityType: "booking",
      entityId: bookingId,
      after: { reference, source: args.source, totalCents },
    });
    return { bookingId, reference, expectedTotalCents: totalCents };
  },
});

export const updateNotes = mutation({
  args: { bookingId: v.id("bookings"), notes: v.string() },
  handler: async (ctx, { bookingId, notes }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    await ctx.db.patch(bookingId, { notes });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.update_notes",
      entityType: "booking",
      entityId: bookingId,
      before: { notes: booking.notes ?? null },
      after: { notes },
    });
    return { changed: true };
  },
});

/** Confirm a pending (website) booking. */
export const confirm = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (booking.status !== "pending") {
      throw new Error(`Only pending bookings can be confirmed (is: ${booking.status}).`);
    }
    await ctx.db.patch(bookingId, { status: "confirmed" });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.confirm",
      entityType: "booking",
      entityId: bookingId,
    });
    return { changed: true };
  },
});

// ---------- Story 6.4: check-in with ID verification ----------

export const checkIn = mutation({
  args: {
    bookingId: v.id("bookings"),
    idVerified: v.boolean(),
    documents: v.optional(
      v.array(
        v.object({
          kind: v.union(v.literal("id_front"), v.literal("id_back")),
          storageId: v.id("_storage"),
        }),
      ),
    ),
  },
  handler: async (ctx, { bookingId, idVerified, documents }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (booking.status !== "confirmed") {
      throw new Error(`Only confirmed bookings can check in (is: ${booking.status}).`);
    }
    const property = (
      await ctx.db
        .query("properties")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )[0];
    if ((property?.idRequired ?? true) && !idVerified) {
      throw new Error("ID verification is required at this property.");
    }
    for (const doc of documents ?? []) {
      await ctx.db.insert("guestDocuments", {
        orgId,
        guestId: booking.guestId,
        bookingId,
        kind: doc.kind,
        storageId: doc.storageId,
      });
    }
    await ctx.db.patch(bookingId, { status: "checked_in" });
    await ctx.db.patch(booking.roomId, { status: "occupied" });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.check_in",
      entityType: "booking",
      entityId: bookingId,
      after: { idVerified, documents: (documents ?? []).length },
    });
    return { changed: true };
  },
});

// ---------- Stories 6.5 + 6.6: check-out (balance gate, assets, housekeeping) ----------

export const checkOut = mutation({
  args: {
    bookingId: v.id("bookings"),
    // 6.5: an outstanding balance blocks checkout unless explicitly excepted.
    balanceException: v.optional(v.object({ reason: v.string() })),
    // 6.6: asset/damage check; a damage charge posts to the ledger.
    assetCheck: v.optional(
      v.object({
        ok: v.boolean(),
        notes: v.optional(v.string()),
        damageChargeCents: v.optional(v.int64()),
      }),
    ),
  },
  handler: async (ctx, { bookingId, balanceException, assetCheck }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (booking.status !== "checked_in") {
      throw new Error(`Only checked-in bookings can check out (is: ${booking.status}).`);
    }

    // Damage first so it lands in the final balance check.
    if (assetCheck && !assetCheck.ok && assetCheck.damageChargeCents) {
      if (assetCheck.damageChargeCents <= 0n) {
        throw new Error("Damage charge must be positive.");
      }
      await postLedgerEntry(ctx, {
        orgId,
        bookingId,
        type: "adjustment",
        amountCents: assetCheck.damageChargeCents,
        currency: booking.currency,
        memo: `Damage: ${assetCheck.notes ?? "asset check"}`,
      });
    }

    const balance = await bookingBalanceCents(ctx, bookingId);
    if (balance > 0n && !balanceException) {
      throw new Error(
        `Outstanding balance of ${balance} cents — record payment or grant an audited exception.`,
      );
    }

    await ctx.db.patch(bookingId, { status: "checked_out" });
    await ctx.db.patch(booking.roomId, { status: "dirty" });
    const room = await ctx.db.get(booking.roomId);
    const taskId = await ctx.db.insert("housekeepingTasks", {
      orgId,
      roomId: booking.roomId,
      bookingId,
      status: "pending",
      priority: "normal",
      notes: `Post-checkout clean — Room ${room?.number ?? "?"}`,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.check_out",
      entityType: "booking",
      entityId: bookingId,
      after: {
        balanceCents: balance,
        exception: balanceException?.reason ?? null,
        assetOk: assetCheck?.ok ?? null,
        damageCents: assetCheck?.damageChargeCents ?? null,
        housekeepingTaskId: taskId,
      },
    });
    return { changed: true, balanceCents: balance };
  },
});

// ---------- Story 6.7: modifications ----------

export const extend = mutation({
  args: { bookingId: v.id("bookings"), newCheckOutDate: v.string() },
  handler: async (ctx, { bookingId, newCheckOutDate }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (!ACTIVE.has(booking.status)) {
      throw new Error(`Cannot extend a ${booking.status} booking.`);
    }
    if (newCheckOutDate <= booking.checkOutDate) {
      throw new Error("New check-out must be after the current check-out.");
    }
    assertDateRange(booking.checkInDate, newCheckOutDate);
    // Only the extension window can conflict (the stay itself is ours).
    if (await hasConflict(ctx, booking.roomId, booking.checkOutDate, newCheckOutDate)) {
      throw new Error("The room is already booked for the extension dates.");
    }
    const plan = booking.ratePlanId ? await ctx.db.get(booking.ratePlanId) : null;
    if (!plan) throw new Error("The booking's rate plan no longer exists.");

    const extraNights = nightsBetween(booking.checkOutDate, newCheckOutDate);
    const { totalCents: deltaCents } = priceStay(
      plan.nightlyCents,
      extraNights,
      await activeTaxBps(ctx, orgId),
    );
    await postLedgerEntry(ctx, {
      orgId,
      bookingId,
      type: "charge",
      amountCents: deltaCents,
      currency: booking.currency,
      memo: `Extension ${booking.checkOutDate} → ${newCheckOutDate} (${extraNights} nights, tax incl.)`,
    });
    await ctx.db.patch(bookingId, {
      checkOutDate: newCheckOutDate,
      expectedTotalCents: booking.expectedTotalCents + deltaCents,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.extend",
      entityType: "booking",
      entityId: bookingId,
      before: { checkOutDate: booking.checkOutDate },
      after: { checkOutDate: newCheckOutDate, deltaCents },
    });
    return { changed: true, deltaCents };
  },
});

export const changeRoom = mutation({
  args: { bookingId: v.id("bookings"), newRoomId: v.id("rooms") },
  handler: async (ctx, { bookingId, newRoomId }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (!ACTIVE.has(booking.status)) {
      throw new Error(`Cannot move a ${booking.status} booking.`);
    }
    const oldRoom = await ctx.db.get(booking.roomId);
    const newRoom = await ctx.db.get(newRoomId);
    if (!newRoom || newRoom.orgId !== orgId) throw new Error("Room not found.");
    if (newRoom.status === "maintenance" || newRoom.status === "blocked") {
      throw new Error("That room is not currently usable.");
    }
    // R1 keeps money exact: same room type only (different type = cancel+rebook).
    if (!oldRoom || newRoom.roomTypeId !== oldRoom.roomTypeId) {
      throw new Error("Room changes must stay within the same room type in R1.");
    }
    if (await hasConflict(ctx, newRoomId, booking.checkInDate, booking.checkOutDate)) {
      throw new Error("The new room is not available for the stay dates.");
    }
    await ctx.db.patch(bookingId, { roomId: newRoomId });
    if (booking.status === "checked_in") {
      await ctx.db.patch(newRoomId, { status: "occupied" });
      await ctx.db.patch(booking.roomId, { status: "dirty" });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.change_room",
      entityType: "booking",
      entityId: bookingId,
      before: { roomId: booking.roomId },
      after: { roomId: newRoomId },
    });
    return { changed: true };
  },
});

export const cancel = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.string(),
    // Default: zero out the open balance so a cancelled stay shows no phantom
    // debt. Pass false to keep charges (e.g. late-cancellation fee policies).
    waiveBalance: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookingId, reason, waiveBalance }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (!ACTIVE.has(booking.status)) {
      throw new Error(`Cannot cancel a ${booking.status} booking.`);
    }
    const balance = await bookingBalanceCents(ctx, bookingId);
    if ((waiveBalance ?? true) && balance !== 0n) {
      await postLedgerEntry(ctx, {
        orgId,
        bookingId,
        type: "adjustment",
        amountCents: -balance,
        currency: booking.currency,
        memo: `Cancellation waiver: ${reason}`,
      });
    }
    await ctx.db.patch(bookingId, { status: "cancelled" });
    if (booking.status === "checked_in") {
      await ctx.db.patch(booking.roomId, { status: "dirty" });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.cancel",
      entityType: "booking",
      entityId: bookingId,
      after: { reason, waivedCents: (waiveBalance ?? true) ? balance : 0n },
    });
    return { changed: true };
  },
});

export const markNoShow = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const { user, orgId } = await requirePermission(ctx, "Bookings", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (booking.status !== "confirmed" && booking.status !== "pending") {
      throw new Error(`Cannot mark a ${booking.status} booking as no-show.`);
    }
    // Charges stay on the ledger (no-show fee policy = keep or adjust manually).
    await ctx.db.patch(bookingId, { status: "no_show" });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.no_show",
      entityType: "booking",
      entityId: bookingId,
    });
    return { changed: true };
  },
});

/**
 * Record a refund (Story 6.7). R1 refunds are settled out-of-band (cash /
 * manual M-Pesa per the Daraja spec §10) — this posts the ledger entry and
 * audits; it does not move money.
 */
export const refund = mutation({
  args: {
    bookingId: v.id("bookings"),
    amountCents: v.int64(),
    reason: v.string(),
  },
  handler: async (ctx, { bookingId, amountCents, reason }) => {
    const { user, orgId } = await requirePermission(ctx, "Payments", "write");
    const booking = await getOrgBooking(ctx, orgId, bookingId);
    if (amountCents <= 0n) throw new Error("Refund amount must be positive.");
    await postLedgerEntry(ctx, {
      orgId,
      bookingId,
      type: "refund",
      amountCents, // positive: money returned raises the open balance
      currency: booking.currency,
      memo: `Refund: ${reason}`,
    });
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "booking.refund",
      entityType: "booking",
      entityId: bookingId,
      after: { amountCents, reason },
    });
    return {
      changed: true,
      balanceCents: await bookingBalanceCents(ctx, bookingId),
    };
  },
});

// ---------- Desk reads ----------

async function bookingRow(ctx: QueryCtx, b: Doc<"bookings">) {
  const guest = await ctx.db.get(b.guestId);
  const room = await ctx.db.get(b.roomId);
  return {
    bookingId: b._id,
    reference: b.reference,
    status: b.status,
    source: b.source,
    checkInDate: b.checkInDate,
    checkOutDate: b.checkOutDate,
    guestName: guest?.fullName ?? "—",
    guestPhone: guest?.phone ?? null,
    roomNumber: room?.number ?? "—",
    notes: b.notes ?? null,
    expectedTotalCents: b.expectedTotalCents,
    balanceCents: await bookingBalanceCents(ctx, b._id),
    currency: b.currency,
  };
}

/** The desk board for one day: arrivals, departures, in-house, pending. */
export const board = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const { orgId } = await requirePermission(ctx, "Bookings", "read");
    const all = await ctx.db
      .query("bookings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const arrivals = [];
    const departures = [];
    const inHouse = [];
    const pending = [];
    for (const b of all) {
      if (b.status === "pending") pending.push(await bookingRow(ctx, b));
      if (b.checkInDate === date && (b.status === "confirmed" || b.status === "pending")) {
        arrivals.push(await bookingRow(ctx, b));
      }
      if (b.status === "checked_in") {
        inHouse.push(await bookingRow(ctx, b));
        if (b.checkOutDate === date) departures.push(await bookingRow(ctx, b));
      }
    }
    return { arrivals, departures, inHouse, pending };
  },
});
