import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal, api } from "./_generated/api";

/**
 * Epic 5 — money engine end-to-end: ledger init on booking (5.2), method
 * config gating (5.1), manual recording + receipt dedupe (5.5), STK callback
 * confirm/fail/idempotency/mismatch (5.4), invoices/receipts from the ledger
 * (5.6), guest portal + requests (5.7), reconciliation list/resolve (5.8).
 */

const IN = "2099-03-01";
const OUT = "2099-03-04"; // 3 nights → 1,050,000 + 16% VAT = 1,218,000 cents

async function seedOrgWithBooking(t: ReturnType<typeof convexTest>, slug: string) {
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
  const booking = await t.mutation(api.guestBookings.create, {
    orgSlug: slug,
    roomId,
    checkInDate: IN,
    checkOutDate: OUT,
    guest: { fullName: "Ada", phone: "+254700000001", email: "ada@g.test", idNumber: "12345678" },
    consent: true,
    paymentMethod: "mpesa_stk",
  });
  return { ...ids, as, roomId, booking };
}

describe("ledger init + method config (5.1, 5.2)", () => {
  it("booking creation posts the stay charge; balance is derived from the ledger", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");

    const entries = await t.run((ctx) => ctx.db.query("ledgerEntries").collect());
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("charge");
    expect(entries[0].amountCents).toBe(1218000n);

    const lookup = await t.query(api.guestBookings.lookup, {
      reference: s.booking.reference,
      contact: "+254700000001",
    });
    expect(lookup?.balanceCents).toBe(1218000n);
  });

  it("a disabled method is rejected at booking time and hidden from the public list", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");
    await s.as.mutation(api.paymentMethods.setEnabled, { method: "card", enabled: false });

    expect(await t.query(api.paymentMethods.enabledMethods, { orgSlug: "acme" })).toEqual(
      ["mpesa_stk", "mpesa_manual", "cash"],
    );
    await expect(
      t.mutation(api.guestBookings.create, {
        orgSlug: "acme",
        roomId: s.roomId,
        checkInDate: "2099-05-01",
        checkOutDate: "2099-05-02",
        guest: { fullName: "Ben", phone: "+254700000002", idNumber: "87654321" },
        consent: true,
        paymentMethod: "card",
      }),
    ).rejects.toThrow(/not available/);
  });
});

describe("manual recording (5.5)", () => {
  it("posts confirmed + unreconciled to the ledger; duplicate receipts rejected; gated", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");

    const r1 = await s.as.mutation(api.payments.recordManual, {
      bookingId: s.booking.bookingId,
      provider: "mpesa_manual",
      amountCents: 500000n,
      receiptNumber: "qabc123xyz", // normalized to uppercase
    });
    expect(r1.balanceCents).toBe(718000n); // 1,218,000 − 500,000

    await expect(
      s.as.mutation(api.payments.recordManual, {
        bookingId: s.booking.bookingId,
        provider: "mpesa_manual",
        amountCents: 100000n,
        receiptNumber: "QABC123XYZ",
      }),
    ).rejects.toThrow(/already recorded/);

    await expect(
      s.as.mutation(api.payments.recordManual, {
        bookingId: s.booking.bookingId,
        provider: "mpesa_manual",
        amountCents: 100000n,
      }),
    ).rejects.toThrow(/receipt code is required/);

    // Cash posts too; balance keeps deriving.
    const r2 = await s.as.mutation(api.payments.recordManual, {
      bookingId: s.booking.bookingId,
      provider: "cash",
      amountCents: 218000n,
    });
    expect(r2.balanceCents).toBe(500000n);

    // Unprivileged staffer denied.
    const staffer = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_staff", name: "Sam", role: "driver" },
    });
    await expect(
      t.withIdentity({ subject: staffer.userId }).mutation(api.payments.recordManual, {
        bookingId: s.booking.bookingId,
        provider: "cash",
        amountCents: 1000n,
      }),
    ).rejects.toThrow(/Payments:write|FORBIDDEN/);
  });
});

describe("STK callback processing (5.4)", () => {
  async function pendingStk(t: ReturnType<typeof convexTest>, s: Awaited<ReturnType<typeof seedOrgWithBooking>>) {
    // Configure Daraja (token needed for callback verification).
    const { callbackToken } = await s.as.mutation(api.mpesa.saveConfig, {
      env: "sandbox",
      shortcode: "174379",
      passkey: "pk",
      consumerKey: "ck",
      consumerSecret: "cs",
      transactionType: "CustomerPayBillOnline",
    });
    await t.mutation(internal.mpesa.recordPending, {
      orgId: s.orgId,
      bookingId: s.booking.bookingId,
      amountCents: 500000n,
      currency: "KES",
      checkoutRequestId: "ws_CO_1",
      merchantRequestId: "m-1",
      phone: "254700000001",
    });
    return callbackToken;
  }

  it("confirms, posts the ledger payment, and is idempotent on retries", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");
    const token = await pendingStk(t, s);

    const args = {
      callbackToken: token,
      checkoutRequestId: "ws_CO_1",
      resultCode: 0,
      resultDesc: "Processed",
      amountKes: 5000,
      receiptNumber: "QSTK111AAA",
      phone: "254700000001",
    };
    const first = await t.mutation(internal.mpesa.processStkResult, args);
    expect(first).toEqual({ outcome: "confirmed", mismatch: false });

    const payment = (await t.run((ctx) => ctx.db.query("payments").collect()))[0];
    expect(payment.status).toBe("confirmed");
    expect(payment.providerReceiptNumber).toBe("QSTK111AAA");
    expect(payment.reconciled).toBe(true);

    // Balance: 1,218,000 − 500,000 paid.
    const lookup = await t.query(api.guestBookings.lookup, {
      reference: s.booking.reference,
      contact: "+254700000001",
    });
    expect(lookup?.balanceCents).toBe(718000n);

    // Daraja retry → no-op, no double ledger entry.
    expect(await t.mutation(internal.mpesa.processStkResult, args)).toEqual({
      outcome: "already_processed",
    });
    const payEntries = (await t.run((ctx) => ctx.db.query("ledgerEntries").collect())).filter(
      (e) => e.type === "payment",
    );
    expect(payEntries).toHaveLength(1);
  });

  it("flags an amount mismatch for reconciliation but still confirms the PAID amount", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");
    const token = await pendingStk(t, s);

    const res = await t.mutation(internal.mpesa.processStkResult, {
      callbackToken: token,
      checkoutRequestId: "ws_CO_1",
      resultCode: 0,
      resultDesc: "Processed",
      amountKes: 4000, // requested 5000
      receiptNumber: "QSTK222BBB",
    });
    expect(res).toEqual({ outcome: "confirmed", mismatch: true });
    const payment = (await t.run((ctx) => ctx.db.query("payments").collect()))[0];
    expect(payment.amountMismatch).toBe(true);
    expect(payment.reconciled).toBe(false);
    expect(payment.amountCents).toBe(400000n); // the real money

    const recon = await s.as.query(api.payments.reconciliationList, {});
    expect(recon.some((r) => r.amountMismatch)).toBe(true);
  });

  it("marks failures (cancel/timeout), rejects bad tokens, logs unmatched ids", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");
    const token = await pendingStk(t, s);

    expect(
      await t.mutation(internal.mpesa.processStkResult, {
        callbackToken: "wrong-token",
        checkoutRequestId: "ws_CO_1",
        resultCode: 0,
        resultDesc: "x",
      }),
    ).toEqual({ outcome: "unauthorized" });

    expect(
      await t.mutation(internal.mpesa.processStkResult, {
        callbackToken: token,
        checkoutRequestId: "ws_CO_1",
        resultCode: 1032,
        resultDesc: "Request cancelled by user",
      }),
    ).toEqual({ outcome: "failed" });
    const payment = (await t.run((ctx) => ctx.db.query("payments").collect()))[0];
    expect(payment.status).toBe("failed");
    expect(payment.resultDesc).toMatch(/cancelled/);
    // No ledger entry for a failed push.
    const payEntries = (await t.run((ctx) => ctx.db.query("ledgerEntries").collect())).filter(
      (e) => e.type === "payment",
    );
    expect(payEntries).toHaveLength(0);

    expect(
      await t.mutation(internal.mpesa.processStkResult, {
        callbackToken: token,
        checkoutRequestId: "ws_CO_UNKNOWN",
        resultCode: 0,
        resultDesc: "x",
      }),
    ).toEqual({ outcome: "unmatched" });
  });
});

describe("invoices & receipts (5.6)", () => {
  it("snapshots ledger lines exactly; receipt needs a payment first", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");

    await expect(
      s.as.mutation(api.invoices.generate, {
        bookingId: s.booking.bookingId,
        isReceipt: true,
      }),
    ).rejects.toThrow(/No payments/);

    const inv = await s.as.mutation(api.invoices.generate, {
      bookingId: s.booking.bookingId,
      isReceipt: false,
    });
    expect(inv.totalCents).toBe(1218000n);
    expect(inv.number).toBe(`INV-${s.booking.reference.replace("BK-", "")}-1`);

    await s.as.mutation(api.payments.recordManual, {
      bookingId: s.booking.bookingId,
      provider: "cash",
      amountCents: 218000n,
    });
    const rct = await s.as.mutation(api.invoices.generate, {
      bookingId: s.booking.bookingId,
      isReceipt: true,
    });
    expect(rct.totalCents).toBe(218000n);
    expect(rct.number).toMatch(/^RCT-/);
  });
});

describe("guest portal + requests (5.7) and reconciliation (5.8)", () => {
  it("portal returns payments/invoices/requests for a verified guest only", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");
    await s.as.mutation(api.payments.recordManual, {
      bookingId: s.booking.bookingId,
      provider: "cash",
      amountCents: 218000n,
    });
    await t.mutation(api.guestRequests.submit, {
      reference: s.booking.reference,
      contact: "ada@g.test",
      message: "Late check-in please",
    });

    const portal = await t.query(api.guestBookings.portal, {
      reference: s.booking.reference,
      contact: "+254700000001",
    });
    expect(portal?.balanceCents).toBe(1000000n);
    expect(portal?.payments).toHaveLength(1);
    expect(portal?.requests[0]).toMatchObject({ message: "Late check-in please", status: "open" });

    expect(
      await t.query(api.guestBookings.portal, {
        reference: s.booking.reference,
        contact: "wrong@x.test",
      }),
    ).toBeNull();
    await expect(
      t.mutation(api.guestRequests.submit, {
        reference: s.booking.reference,
        contact: "wrong@x.test",
        message: "hi",
      }),
    ).rejects.toThrow(/Booking not found/);

    // Staff see and resolve the request.
    const queue = await s.as.query(api.guestRequests.listForOrg, {});
    expect(queue).toHaveLength(1);
    await s.as.mutation(api.guestRequests.resolve, { requestId: queue[0].requestId });
    expect((await s.as.query(api.guestRequests.listForOrg, {}))[0].status).toBe("resolved");
  });

  it("reconciliation lists unreconciled payments and resolve is audited + gated", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedOrgWithBooking(t, "acme");
    await s.as.mutation(api.payments.recordManual, {
      bookingId: s.booking.bookingId,
      provider: "mpesa_manual",
      amountCents: 100000n,
      receiptNumber: "QM111",
    });

    const list = await s.as.query(api.payments.reconciliationList, {});
    expect(list).toHaveLength(1);
    expect(list[0].receiptNumber).toBe("QM111");

    await s.as.mutation(api.payments.resolveReconciliation, {
      paymentId: list[0].paymentId,
    });
    expect(await s.as.query(api.payments.reconciliationList, {})).toHaveLength(0);
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditLogs")
        .filter((q) => q.eq(q.field("action"), "payment.reconcile"))
        .collect(),
    );
    expect(audits).toHaveLength(1);
  });
});
