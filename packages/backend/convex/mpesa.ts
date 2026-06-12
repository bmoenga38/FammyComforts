import { v } from "convex/values";
import {
  action,
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { postLedgerEntry } from "./lib/ledger";
import { enabledMethodsFor } from "./paymentMethods";
import {
  DARAJA_BASE,
  normalizeMsisdn,
  centsToWholeShillings,
  darajaTimestamp,
  stkPassword,
} from "./lib/mpesa";

// Convex injects `process.env` at runtime; the backend tsconfig has no Node types.
declare const process: { env: Record<string, string | undefined> };

/**
 * M-Pesa STK push (Stories 5.3 + 5.4) per mpesa-daraja-integration-spec.md,
 * adapted to Convex + multi-tenancy: each org stores its OWN Daraja credentials
 * (own paybill — two-layer model); the OAuth token is cached on the config row;
 * the callback is a Convex HTTP action that hands off to a transactional
 * internal mutation (the queue/idempotency layer).
 */

const REF_TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// ---------- Admin config (Payments:manage) ----------

export const saveConfig = mutation({
  args: {
    env: v.union(v.literal("sandbox"), v.literal("production")),
    shortcode: v.string(),
    passkey: v.string(),
    consumerKey: v.string(),
    consumerSecret: v.string(),
    transactionType: v.union(
      v.literal("CustomerPayBillOnline"),
      v.literal("CustomerBuyGoodsOnline"),
    ),
  },
  handler: async (ctx, args) => {
    const { user, orgId } = await requirePermission(ctx, "Payments", "manage");
    const existing = await ctx.db
      .query("mpesaConfigs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    // Keep the callback token stable across credential updates.
    let callbackToken = existing?.callbackToken;
    if (!callbackToken) {
      callbackToken = "";
      for (let i = 0; i < 32; i++) {
        callbackToken +=
          REF_TOKEN_ALPHABET[Math.floor(Math.random() * REF_TOKEN_ALPHABET.length)];
      }
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        callbackToken,
        cachedAccessToken: undefined,
        cachedTokenExpiresAt: undefined,
      });
    } else {
      await ctx.db.insert("mpesaConfigs", { orgId, ...args, callbackToken });
    }
    // Audited WITHOUT secrets (passkey/keys never logged).
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "mpesa.config_saved",
      entityType: "mpesaConfig",
      after: { env: args.env, shortcode: args.shortcode, transactionType: args.transactionType },
    });
    return { callbackToken };
  },
});

/** Masked status for the admin UI — never returns secrets. */
export const configStatus = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Payments", "read");
    const cfg = await ctx.db
      .query("mpesaConfigs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    if (!cfg) return { configured: false as const };
    return {
      configured: true as const,
      env: cfg.env,
      shortcode: cfg.shortcode,
      transactionType: cfg.transactionType,
      callbackToken: cfg.callbackToken, // needed to register the URL with Daraja
    };
  },
});

// ---------- Internal plumbing for the initiation action ----------

export const loadForInitiation = internalQuery({
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
      (guest.phone.toLowerCase() !== needle &&
        (guest.email ?? "").toLowerCase() !== needle)
    ) {
      return null; // same as not-found — no enumeration
    }
    const cfg = await ctx.db
      .query("mpesaConfigs")
      .withIndex("by_org", (q) => q.eq("orgId", booking.orgId))
      .unique();
    const enabled = (await enabledMethodsFor(ctx, booking.orgId)).includes("mpesa_stk");
    return {
      orgId: booking.orgId,
      bookingId: booking._id,
      bookingReference: booking.reference,
      currency: booking.currency,
      stkEnabled: enabled,
      config: cfg
        ? {
            env: cfg.env,
            shortcode: cfg.shortcode,
            passkey: cfg.passkey,
            consumerKey: cfg.consumerKey,
            consumerSecret: cfg.consumerSecret,
            transactionType: cfg.transactionType,
            callbackToken: cfg.callbackToken,
            cachedAccessToken: cfg.cachedAccessToken,
            cachedTokenExpiresAt: cfg.cachedTokenExpiresAt,
          }
        : null,
    };
  },
});

export const cacheToken = internalMutation({
  args: {
    orgId: v.id("organizations"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { orgId, accessToken, expiresAt }) => {
    const cfg = await ctx.db
      .query("mpesaConfigs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        cachedAccessToken: accessToken,
        cachedTokenExpiresAt: expiresAt,
      });
    }
  },
});

export const recordPending = internalMutation({
  args: {
    orgId: v.id("organizations"),
    bookingId: v.id("bookings"),
    amountCents: v.int64(),
    currency: v.string(),
    checkoutRequestId: v.string(),
    merchantRequestId: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const paymentId = await ctx.db.insert("payments", {
      orgId: args.orgId,
      bookingId: args.bookingId,
      provider: "mpesa_stk",
      status: "pending",
      amountCents: args.amountCents,
      currency: args.currency,
      providerCheckoutRequestId: args.checkoutRequestId,
      providerMerchantRequestId: args.merchantRequestId,
      paidPhone: args.phone,
      reconciled: false,
    });
    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      action: "payment.stk_initiated",
      entityType: "payment",
      entityId: paymentId,
      after: { amountCents: args.amountCents, checkoutRequestId: args.checkoutRequestId },
    });
    return paymentId;
  },
});

// ---------- Story 5.3: STK initiation (public — guest portal or desk) ----------

export const initiateStk = action({
  args: {
    reference: v.string(),
    contact: v.string(),
    phone: v.string(),
    amountCents: v.int64(),
  },
  handler: async (
    ctx,
    { reference, contact, phone, amountCents },
  ): Promise<{ checkoutRequestId: string; customerMessage: string }> => {
    const loaded = await ctx.runQuery(internal.mpesa.loadForInitiation, {
      reference,
      contact,
    });
    if (!loaded) throw new Error("Booking not found.");
    if (!loaded.stkEnabled) throw new Error("M-Pesa is disabled for this property.");
    if (!loaded.config) {
      throw new Error("M-Pesa is not configured for this property yet.");
    }
    const cfg = loaded.config;
    const msisdn = normalizeMsisdn(phone);
    const amountKes = centsToWholeShillings(amountCents);
    const base = DARAJA_BASE[cfg.env];

    // OAuth — reuse the cached token until 60s before expiry (spec §2).
    let token = cfg.cachedAccessToken;
    if (!token || !cfg.cachedTokenExpiresAt || cfg.cachedTokenExpiresAt < Date.now()) {
      const res = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${btoa(`${cfg.consumerKey}:${cfg.consumerSecret}`)}`,
        },
      });
      if (!res.ok) throw new Error("M-Pesa authentication failed.");
      const data = (await res.json()) as { access_token: string; expires_in: string | number };
      token = data.access_token;
      await ctx.runMutation(internal.mpesa.cacheToken, {
        orgId: loaded.orgId,
        accessToken: token,
        expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
      });
    }

    const timestamp = darajaTimestamp(Date.now());
    const callbackBase = process.env.CONVEX_SITE_URL ?? "";
    const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
        Timestamp: timestamp,
        TransactionType: cfg.transactionType,
        Amount: amountKes,
        PartyA: msisdn,
        PartyB: cfg.shortcode,
        PhoneNumber: msisdn,
        CallBackURL: `${callbackBase}/mpesa/callback/${cfg.callbackToken}`,
        AccountReference: loaded.bookingReference,
        TransactionDesc: `Fammy Comforts ${loaded.bookingReference}`,
      }),
    });
    const body = (await res.json()) as {
      ResponseCode?: string;
      ResponseDescription?: string;
      CustomerMessage?: string;
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      errorMessage?: string;
    };
    if (!res.ok || body.ResponseCode !== "0" || !body.CheckoutRequestID) {
      throw new Error(
        body.ResponseDescription ?? body.errorMessage ?? "M-Pesa push was not accepted.",
      );
    }

    await ctx.runMutation(internal.mpesa.recordPending, {
      orgId: loaded.orgId,
      bookingId: loaded.bookingId,
      amountCents,
      currency: loaded.currency,
      checkoutRequestId: body.CheckoutRequestID,
      merchantRequestId: body.MerchantRequestID ?? "",
      phone: msisdn,
    });
    return {
      checkoutRequestId: body.CheckoutRequestID,
      customerMessage: body.CustomerMessage ?? "Check your phone to complete payment.",
    };
  },
});

// ---------- Story 5.4: callback processing (idempotent, transactional) ----------

export const processStkResult = internalMutation({
  args: {
    callbackToken: v.string(),
    checkoutRequestId: v.string(),
    resultCode: v.number(),
    resultDesc: v.string(),
    amountKes: v.optional(v.number()),
    receiptNumber: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_checkout_request", (q) =>
        q.eq("providerCheckoutRequestId", args.checkoutRequestId),
      )
      .unique();
    if (!payment) {
      // Unknown CheckoutRequestID: log + leave for reconciliation; never 4xx
      // Daraja (spec §4.3). No org context — unscoped audit row.
      await ctx.db.insert("auditLogs", {
        action: "payment.callback_unmatched",
        entityType: "payment",
        after: { checkoutRequestId: args.checkoutRequestId, resultCode: args.resultCode },
      });
      return { outcome: "unmatched" as const };
    }

    // Verify the shared callback token against THIS org's config (spec §7).
    const cfg = await ctx.db
      .query("mpesaConfigs")
      .withIndex("by_org", (q) => q.eq("orgId", payment.orgId))
      .unique();
    if (!cfg || cfg.callbackToken !== args.callbackToken) {
      return { outcome: "unauthorized" as const };
    }

    // Idempotency: Daraja retries must be no-ops (spec §4.2).
    if (payment.status !== "pending") {
      return { outcome: "already_processed" as const };
    }

    if (args.resultCode !== 0) {
      await ctx.db.patch(payment._id, {
        status: "failed",
        resultDesc: args.resultDesc,
      });
      await ctx.db.insert("auditLogs", {
        orgId: payment.orgId,
        action: "payment.failed",
        entityType: "payment",
        entityId: payment._id,
        after: { resultCode: args.resultCode, resultDesc: args.resultDesc },
      });
      return { outcome: "failed" as const };
    }

    // Success: confirm, post the PAID amount to the ledger, flag mismatches.
    const paidCents =
      args.amountKes !== undefined
        ? BigInt(Math.round(args.amountKes)) * 100n
        : payment.amountCents;
    const mismatch = paidCents !== payment.amountCents;
    await ctx.db.patch(payment._id, {
      status: "confirmed",
      providerReceiptNumber: args.receiptNumber,
      paidPhone: args.phone ?? payment.paidPhone,
      paidAt: Date.now(),
      amountCents: paidCents,
      amountMismatch: mismatch || undefined,
      reconciled: !mismatch, // mismatches stay open for Story 5.8
    });
    if (payment.bookingId) {
      await postLedgerEntry(ctx, {
        orgId: payment.orgId,
        bookingId: payment.bookingId,
        type: "payment",
        amountCents: -paidCents,
        currency: payment.currency,
        memo: `mpesa_stk ${args.receiptNumber ?? ""}`.trim(),
        paymentId: payment._id as Id<"payments">,
      });
    }
    await ctx.db.insert("auditLogs", {
      orgId: payment.orgId,
      action: "payment.confirmed",
      entityType: "payment",
      entityId: payment._id,
      after: {
        receiptNumber: args.receiptNumber ?? null,
        paidCents,
        amountMismatch: mismatch,
      },
    });
    return { outcome: "confirmed" as const, mismatch };
  },
});
