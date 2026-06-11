import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Epic 4 — public catalog + no-account booking. Covers: catalog pricing +
 * availability filtering (4.1–4.3, exact integer-cents math incl. 16% VAT),
 * booking create with consent/validation (4.4), ID document attach (4.5),
 * payment intent + splits (4.6), unique BK- reference + queued notification
 * (4.7), lookup with anti-enumeration contact match (4.8), tenant isolation.
 */

// Far-future dates so the no-past-check-in rule never bites the suite.
const IN = "2099-03-01";
const OUT = "2099-03-04"; // 3 nights

// JSON.stringify cannot serialize BigInt (int64 money fields) — coerce for assertions.
const asJson = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

async function seedOrg(t: ReturnType<typeof convexTest>, slug: string) {
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
    name: "Fammy Nairobi",
    checkInTime: "14:00",
    checkOutTime: "10:00",
    idRequired: true,
  });
  const branchId = await as.mutation(api.branches.create, {
    propertyId,
    name: "Main",
    location: "CBD",
  });
  const wifi = await as.mutation(api.amenities.create, { name: "Wi-Fi" });
  const roomTypeId = await as.mutation(api.roomTypes.create, {
    name: "Deluxe",
    capacity: 2,
    sizeSqm: 24,
    amenityIds: [wifi],
  });
  await as.mutation(api.rates.createRatePlan, {
    roomTypeId,
    name: "Nightly",
    nightlyCents: 350000n, // KES 3,500/night
  });
  await as.mutation(api.rates.createTaxRule, { name: "VAT", rate: 0.16 });
  await as.mutation(api.notifications.setEnabled, {
    type: "booking_confirmation",
    channel: "sms",
    enabled: true,
  });
  const roomId = await as.mutation(api.rooms.create, {
    branchId,
    roomTypeId,
    number: "101",
  });
  return { ...ids, as, branchId, roomTypeId, roomId };
}

const GUEST = {
  fullName: "Ada Guest",
  phone: "+254700000001",
  email: "ada@guest.test",
};

describe("catalog (4.1–4.3)", () => {
  it("lists room cards with price/capacity/location and exact 3-night totals incl. VAT", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seedOrg(t, "acme");

    const { propertyName, rooms } = await t.query(api.catalog.rooms, {
      orgSlug: "acme",
      checkIn: IN,
      checkOut: OUT,
    });
    expect(propertyName).toBe("Org acme");
    expect(rooms).toHaveLength(1);
    const card = rooms[0];
    expect(card.number).toBe("101");
    expect(card.typeName).toBe("Deluxe");
    expect(card.capacity).toBe(2);
    expect(card.location).toBe("CBD");
    expect(card.available).toBe(true);
    // 3 × 350000 = 1,050,000; VAT 16% = 168,000; total 1,218,000.
    expect(card.totals).toEqual({
      subtotalCents: 1050000n,
      taxCents: 168000n,
      totalCents: 1218000n,
    });
  });

  it("roomDetail returns amenities + property policy; cross-tenant id returns null", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrg(t, "acme");
    await seedOrg(t, "beta");

    const detail = await t.query(api.catalog.roomDetail, {
      orgSlug: "acme",
      roomId: a.roomId,
    });
    expect(detail?.amenities).toEqual(["Wi-Fi"]);
    expect(detail?.checkInTime).toBe("14:00");
    expect(detail?.idRequired).toBe(true);

    // Org beta's slug cannot read org acme's room.
    expect(
      await t.query(api.catalog.roomDetail, { orgSlug: "beta", roomId: a.roomId }),
    ).toBeNull();
  });

  it("date search marks a conflicted room unavailable; back-to-back stays are fine", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrg(t, "acme");
    await t.mutation(api.guestBookings.create, {
      orgSlug: "acme",
      roomId: a.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      guest: GUEST,
      consent: true,
      paymentMethod: "mpesa_stk",
    });

    const overlapping = await t.query(api.catalog.rooms, {
      orgSlug: "acme",
      checkIn: "2099-03-03", // overlaps [03-01, 03-04)
      checkOut: "2099-03-05",
    });
    expect(overlapping.rooms[0].available).toBe(false);

    const backToBack = await t.query(api.catalog.rooms, {
      orgSlug: "acme",
      checkIn: OUT, // starts the day the first stay checks out
      checkOut: "2099-03-06",
    });
    expect(backToBack.rooms[0].available).toBe(true);
  });
});

describe("booking create (4.4–4.7)", () => {
  it("creates a pending booking: BK- reference, guest stored, docs linked, notification queued, audited", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrg(t, "acme");
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["id-front"])));

    const res = await t.mutation(api.guestBookings.create, {
      orgSlug: "acme",
      roomId: a.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      guest: { ...GUEST, idType: "national_id", idNumber: "12345678" },
      consent: true,
      paymentMethod: "mpesa_stk",
      paymentSplits: [{ method: "mpesa_stk", amountCents: 500000n }],
      documents: [{ kind: "id_front", storageId }],
    });
    expect(res.reference).toMatch(/^BK-[A-Z2-9]{6}$/);
    expect(res.status).toBe("pending");
    expect(res.expectedTotalCents).toBe(1218000n);

    const docs = await t.run((ctx) => ctx.db.query("guestDocuments").collect());
    expect(docs).toHaveLength(1);
    expect(docs[0].kind).toBe("id_front");

    const queued = await t.run((ctx) =>
      ctx.db.query("outboundNotifications").collect(),
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      type: "booking_confirmation",
      channel: "sms",
      status: "queued",
    });

    // Audit row exists and never contains the ID number.
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .filter((q) => q.eq(q.field("action"), "booking.create"))
        .collect(),
    );
    expect(audits).toHaveLength(1);
    expect(asJson(audits[0].after)).not.toContain("12345678");
  });

  it("rejects: no consent, missing phone, past check-in, bad range, oversized split", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrg(t, "acme");
    const base = {
      orgSlug: "acme",
      roomId: a.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      guest: GUEST,
      consent: true,
      paymentMethod: "cash" as const,
    };

    await expect(
      t.mutation(api.guestBookings.create, { ...base, consent: false }),
    ).rejects.toThrow(/Consent/);
    await expect(
      t.mutation(api.guestBookings.create, {
        ...base,
        guest: { ...GUEST, phone: "  " },
      }),
    ).rejects.toThrow(/Phone/);
    await expect(
      t.mutation(api.guestBookings.create, {
        ...base,
        checkInDate: "2020-01-01",
        checkOutDate: "2020-01-02",
      }),
    ).rejects.toThrow(/past/);
    await expect(
      t.mutation(api.guestBookings.create, {
        ...base,
        checkInDate: OUT,
        checkOutDate: IN,
      }),
    ).rejects.toThrow(/after/);
    await expect(
      t.mutation(api.guestBookings.create, {
        ...base,
        paymentSplits: [{ method: "cash", amountCents: 9999999999n }],
      }),
    ).rejects.toThrow(/exceed/);

    expect(await t.run((ctx) => ctx.db.query("bookings").collect())).toHaveLength(0);
  });

  it("prevents double-booking the same room for overlapping dates", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrg(t, "acme");
    const args = {
      orgSlug: "acme",
      roomId: a.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      guest: GUEST,
      consent: true,
      paymentMethod: "cash" as const,
    };
    await t.mutation(api.guestBookings.create, args);
    await expect(t.mutation(api.guestBookings.create, args)).rejects.toThrow(
      /no longer available/,
    );
    expect(await t.run((ctx) => ctx.db.query("bookings").collect())).toHaveLength(1);
  });

  it("rejects booking another tenant's room through the wrong slug", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrg(t, "acme");
    await seedOrg(t, "beta");
    await expect(
      t.mutation(api.guestBookings.create, {
        orgSlug: "beta",
        roomId: a.roomId, // acme's room
        checkInDate: IN,
        checkOutDate: OUT,
        guest: GUEST,
        consent: true,
        paymentMethod: "cash",
      }),
    ).rejects.toThrow(/Room not found/);
  });
});

describe("lookup (4.8)", () => {
  it("returns the booking with phone or email, null with a wrong contact", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedOrg(t, "acme");
    const { reference } = await t.mutation(api.guestBookings.create, {
      orgSlug: "acme",
      roomId: a.roomId,
      checkInDate: IN,
      checkOutDate: OUT,
      guest: GUEST,
      consent: true,
      paymentMethod: "mpesa_stk",
    });

    const byPhone = await t.query(api.guestBookings.lookup, {
      reference,
      contact: GUEST.phone,
    });
    expect(byPhone).toMatchObject({
      reference,
      status: "pending",
      roomNumber: "101",
      roomType: "Deluxe",
      balanceCents: 1218000n,
    });
    // idNumber never leaks through the public view.
    expect(asJson(byPhone)).not.toContain("idNumber");

    const byEmail = await t.query(api.guestBookings.lookup, {
      reference,
      contact: "ADA@guest.test", // case-insensitive
    });
    expect(byEmail?.reference).toBe(reference);

    expect(
      await t.query(api.guestBookings.lookup, {
        reference,
        contact: "+254799999999",
      }),
    ).toBeNull();
    expect(
      await t.query(api.guestBookings.lookup, { reference: "BK-NOPE99", contact: GUEST.phone }),
    ).toBeNull();
  });
});
