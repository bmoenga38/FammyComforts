import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Epic 6 — front-desk lifecycle: desk create (6.1), guest profiles + stats
 * (6.2), calendar grid (6.3), check-in w/ ID gate (6.4), check-out balance gate
 * + exception + damage + housekeeping trigger (6.5/6.6), modifications incl.
 * exact extension pricing and refund sign (6.7), split payments via ledger (6.8).
 */

const IN = "2099-03-01";
const OUT = "2099-03-04"; // 3 nights @3500 + 16% = 1,218,000 cents

async function seed(t: ReturnType<typeof convexTest>, slug = "acme") {
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: `bb_${slug}`, name: `Org ${slug}`, slug },
    user: { bytebazaarUserId: `bb_admin_${slug}`, name: "Owner", role: "org_admin" },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: ids.orgId,
    userId: ids.userId,
    ssoRole: "org_admin",
  });
  const as = t.withIdentity({ subject: ids.userId });
  const propertyId = await as.mutation(api.property.create, {
    name: "P",
    checkInTime: "14:00",
    checkOutTime: "10:00",
    idRequired: true,
  });
  const branchId = await as.mutation(api.branches.create, { propertyId, name: "Main" });
  const roomTypeId = await as.mutation(api.roomTypes.create, { name: "Std", capacity: 2 });
  await as.mutation(api.rates.createRatePlan, {
    roomTypeId,
    name: "Nightly",
    nightlyCents: 350000n,
  });
  await as.mutation(api.rates.createTaxRule, { name: "VAT", rate: 0.16 });
  const roomId = await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "101" });
  const room2 = await as.mutation(api.rooms.create, { branchId, roomTypeId, number: "102" });
  return { ...ids, as, branchId, roomTypeId, roomId, room2 };
}

async function deskBooking(s: Awaited<ReturnType<typeof seed>>) {
  return await s.as.mutation(api.deskBookings.create, {
    roomId: s.roomId,
    checkInDate: IN,
    checkOutDate: OUT,
    newGuest: { fullName: "Walk In", phone: "+254700000009" },
    source: "walk_in",
    paymentMethod: "cash",
  });
}

describe("desk create + guests (6.1, 6.2)", () => {
  it("creates a confirmed booking with charge posted; guest stats reflect payments", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const b = await deskBooking(s);
    expect(b.expectedTotalCents).toBe(1218000n);

    const board = await s.as.query(api.deskBookings.board, { date: IN });
    expect(board.arrivals).toHaveLength(1);
    expect(board.arrivals[0].status).toBe("confirmed");
    expect(board.arrivals[0].balanceCents).toBe(1218000n);

    await s.as.mutation(api.payments.recordManual, {
      bookingId: b.bookingId,
      provider: "cash",
      amountCents: 1218000n,
    });
    const guests = await s.as.query(api.guests.list, {});
    expect(guests[0]).toMatchObject({
      fullName: "Walk In",
      bookingCount: 1,
      totalSpentCents: 1218000n,
    });

    // Guest update audits field names only (never ID values).
    await s.as.mutation(api.guests.update, {
      guestId: guests[0].guestId,
      idType: "national_id",
      idNumber: "99887766",
    });
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .filter((q) => q.eq(q.field("action"), "guest.update"))
        .collect(),
    );
    expect(JSON.stringify(audits[0].after)).not.toContain("99887766");
  });

  it("desk create enforces availability and disabled methods", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    await deskBooking(s);
    await expect(deskBooking(s)).rejects.toThrow(/not available/);

    await s.as.mutation(api.paymentMethods.setEnabled, { method: "card", enabled: false });
    await expect(
      s.as.mutation(api.deskBookings.create, {
        roomId: s.room2,
        checkInDate: IN,
        checkOutDate: OUT,
        newGuest: { fullName: "X", phone: "+254700000010" },
        source: "phone",
        paymentMethod: "card",
      }),
    ).rejects.toThrow(/disabled/);
  });
});

describe("check-in / check-out (6.4–6.6)", () => {
  it("runs the full lifecycle: ID gate, occupied, balance gate, damage, housekeeping", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const b = await deskBooking(s);

    // ID required at this property → unverified check-in rejected.
    await expect(
      s.as.mutation(api.deskBookings.checkIn, { bookingId: b.bookingId, idVerified: false }),
    ).rejects.toThrow(/ID verification/);
    await s.as.mutation(api.deskBookings.checkIn, {
      bookingId: b.bookingId,
      idVerified: true,
    });
    let room = await t.run((ctx) => ctx.db.get(s.roomId));
    expect(room?.status).toBe("occupied");

    // Outstanding balance blocks checkout…
    await expect(
      s.as.mutation(api.deskBookings.checkOut, { bookingId: b.bookingId }),
    ).rejects.toThrow(/Outstanding balance/);

    // …pay all but 18,000, then check out with damage + audited exception.
    await s.as.mutation(api.payments.recordManual, {
      bookingId: b.bookingId,
      provider: "cash",
      amountCents: 1200000n,
    });
    const res = await s.as.mutation(api.deskBookings.checkOut, {
      bookingId: b.bookingId,
      balanceException: { reason: "Manager approved corporate invoice" },
      assetCheck: { ok: false, notes: "Broken lamp", damageChargeCents: 150000n },
    });
    // 1,218,000 − 1,200,000 + 150,000 damage = 168,000 outstanding (excepted).
    expect(res.balanceCents).toBe(168000n);

    room = await t.run((ctx) => ctx.db.get(s.roomId));
    expect(room?.status).toBe("dirty");
    const tasks = await t.run((ctx) => ctx.db.query("housekeepingTasks").collect());
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ status: "pending", roomId: s.roomId });

    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .filter((q) => q.eq(q.field("action"), "booking.check_out"))
        .collect(),
    );
    expect(audit).toHaveLength(1);
  });

  it("settled balance checks out without exception; clean asset check", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const b = await deskBooking(s);
    await s.as.mutation(api.deskBookings.checkIn, { bookingId: b.bookingId, idVerified: true });
    await s.as.mutation(api.payments.recordManual, {
      bookingId: b.bookingId,
      provider: "cash",
      amountCents: 1218000n,
    });
    const res = await s.as.mutation(api.deskBookings.checkOut, {
      bookingId: b.bookingId,
      assetCheck: { ok: true },
    });
    expect(res.balanceCents).toBe(0n);
  });
});

describe("modifications (6.7) + split payments (6.8)", () => {
  it("extends with exact delta pricing and blocks conflicting extensions", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const b = await deskBooking(s);

    // Another booking right after ours on the same room: 03-06 → 03-08.
    await s.as.mutation(api.deskBookings.create, {
      roomId: s.roomId,
      checkInDate: "2099-03-06",
      checkOutDate: "2099-03-08",
      newGuest: { fullName: "Next", phone: "+254700000011" },
      source: "phone",
      paymentMethod: "cash",
    });

    // Extend by 2 nights (03-04 → 03-06): 2 × 350,000 + 16% = 812,000.
    const ext = await s.as.mutation(api.deskBookings.extend, {
      bookingId: b.bookingId,
      newCheckOutDate: "2099-03-06",
    });
    expect(ext.deltaCents).toBe(812000n);
    const board = await s.as.query(api.deskBookings.board, { date: IN });
    expect(board.arrivals[0].balanceCents).toBe(2030000n); // 1,218,000 + 812,000

    // Extending into the next booking's dates fails.
    await expect(
      s.as.mutation(api.deskBookings.extend, {
        bookingId: b.bookingId,
        newCheckOutDate: "2099-03-07",
      }),
    ).rejects.toThrow(/already booked/);
  });

  it("changes room within the same type only; cancel waives; refund raises balance", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const b = await deskBooking(s);

    await s.as.mutation(api.deskBookings.changeRoom, {
      bookingId: b.bookingId,
      newRoomId: s.room2,
    });
    const booking = await t.run((ctx) => ctx.db.get(b.bookingId));
    expect(booking?.roomId).toBe(s.room2);
    // Old room frees up for the same dates.
    expect(
      (await t.query(api.catalog.rooms, { orgSlug: "acme", checkIn: IN, checkOut: OUT })).rooms.find(
        (r) => r.number === "101",
      )?.available,
    ).toBe(true);

    // Pay 500,000 then cancel: waiver zeroes the open balance.
    await s.as.mutation(api.payments.recordManual, {
      bookingId: b.bookingId,
      provider: "cash",
      amountCents: 500000n,
    });
    await s.as.mutation(api.deskBookings.cancel, {
      bookingId: b.bookingId,
      reason: "Guest emergency",
    });
    const lookupAfterCancel = await s.as.query(api.payments.forBooking, {
      bookingId: b.bookingId,
    });
    expect(lookupAfterCancel?.balanceCents).toBe(0n);

    // Refund the 500,000 paid: balance rises by the refund (now 500,000 owed→0 net cash).
    const ref = await s.as.mutation(api.deskBookings.refund, {
      bookingId: b.bookingId,
      amountCents: 500000n,
      reason: "Cancellation refund",
    });
    expect(ref.balanceCents).toBe(500000n);
  });

  it("marks no-show, keeps charges, and gates desk ops by permission", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    const b = await deskBooking(s);
    await s.as.mutation(api.deskBookings.markNoShow, { bookingId: b.bookingId });
    const booking = await t.run((ctx) => ctx.db.get(b.bookingId));
    expect(booking?.status).toBe("no_show");
    expect(
      (await s.as.query(api.payments.forBooking, { bookingId: b.bookingId }))?.balanceCents,
    ).toBe(1218000n); // charges stay

    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_staff", name: "Sam", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: staffer.userId }).query(api.deskBookings.board, { date: IN }),
    ).rejects.toThrow(/Bookings:read|FORBIDDEN/);
  });
});

describe("calendar (6.3)", () => {
  it("returns rooms with booking spans in range and caps the window", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seed(t);
    await deskBooking(s);

    const grid = await s.as.query(api.calendar.grid, {
      from: "2099-02-28",
      to: "2099-03-10",
    });
    const room101 = grid.find((r) => r.number === "101")!;
    expect(room101.spans).toHaveLength(1);
    expect(room101.spans[0]).toMatchObject({
      checkInDate: IN,
      checkOutDate: OUT,
      status: "confirmed",
      guestName: "Walk In",
    });
    expect(grid.find((r) => r.number === "102")!.spans).toHaveLength(0);

    // 73 days: between the calendar's 60-day cap and the 90-night domain cap.
    await expect(
      s.as.query(api.calendar.grid, { from: "2099-01-01", to: "2099-03-15" }),
    ).rejects.toThrow(/capped/);
  });
});
