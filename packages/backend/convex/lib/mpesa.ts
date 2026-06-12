/**
 * Pure Daraja (M-Pesa STK) helpers — per `mpesa-daraja-integration-spec.md`.
 * No IO here: everything is unit-testable without HTTP. The action layer
 * (`convex/mpesa.ts`) does the fetches.
 */

export const DARAJA_BASE = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
} as const;

/**
 * Normalize a Kenyan MSISDN to `2547XXXXXXXX`. Accepted inputs per the spec:
 * `07XXXXXXXX`, `+2547XXXXXXXX`, `2547XXXXXXXX` — anything else is rejected.
 */
export function normalizeMsisdn(input: string): string {
  const raw = input.trim().replace(/[\s-]/g, "");
  if (/^07\d{8}$/.test(raw)) return `254${raw.slice(1)}`;
  if (/^\+2547\d{8}$/.test(raw)) return raw.slice(1);
  if (/^2547\d{8}$/.test(raw)) return raw;
  throw new Error("Enter a valid Safaricom number (07XX XXX XXX).");
}

/**
 * M-Pesa has no cents: amounts must be whole shillings. Converts integer cents
 * to the integer-KES `Amount` Daraja expects, rejecting fractional shillings.
 */
export function centsToWholeShillings(amountCents: bigint): number {
  if (amountCents <= 0n) throw new Error("Amount must be positive.");
  if (amountCents % 100n !== 0n) {
    throw new Error("M-Pesa amounts must be whole shillings (no cents).");
  }
  return Number(amountCents / 100n);
}

/** Daraja timestamp: `YYYYMMDDHHmmss` in Africa/Nairobi (UTC+3, no DST). */
export function darajaTimestamp(nowMs: number): string {
  const nairobi = new Date(nowMs + 3 * 3600 * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${nairobi.getUTCFullYear()}${p(nairobi.getUTCMonth() + 1)}${p(nairobi.getUTCDate())}` +
    `${p(nairobi.getUTCHours())}${p(nairobi.getUTCMinutes())}${p(nairobi.getUTCSeconds())}`
  );
}

/** STK password: base64(Shortcode + Passkey + Timestamp). */
export function stkPassword(
  shortcode: string,
  passkey: string,
  timestamp: string,
): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/** Parsed result of a Daraja STK callback body. */
export type StkCallbackResult = {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  /** Present only on success (ResultCode 0). */
  amountKes?: number;
  receiptNumber?: string;
  phone?: string;
};

/**
 * Parse `Body.stkCallback` defensively (never trust shape). Throws on a body
 * that isn't a Daraja STK callback at all.
 */
export function parseStkCallback(body: unknown): StkCallbackResult {
  const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body
    ?.stkCallback;
  if (
    !cb ||
    typeof cb.CheckoutRequestID !== "string" ||
    typeof cb.ResultCode !== "number"
  ) {
    throw new Error("Not a Daraja STK callback.");
  }
  const result: StkCallbackResult = {
    merchantRequestId: String(cb.MerchantRequestID ?? ""),
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode,
    resultDesc: String(cb.ResultDesc ?? ""),
  };
  const items = (
    cb.CallbackMetadata as { Item?: { Name?: string; Value?: unknown }[] }
  )?.Item;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.Name === "Amount" && typeof item.Value === "number") {
        result.amountKes = item.Value;
      } else if (item.Name === "MpesaReceiptNumber") {
        result.receiptNumber = String(item.Value);
      } else if (item.Name === "PhoneNumber") {
        result.phone = String(item.Value);
      }
    }
  }
  return result;
}
