# M-Pesa Daraja Integration Spec — SommyComfort

**Date:** 2026-06-04
**Owner stories:** Epic 5 — Story 5.3 (STK initiation), Story 5.4 (callback processing), Story 5.5 (manual reference). Supports FR7, FR15, FR24; NFR14 (money correctness), AR7.
**Scope:** M-Pesa "Lipa Na M-Pesa Online" (STK Push) via Safaricom **Daraja** API, plus manual reference capture as the offline fallback. Card/POS and cash are recorded directly through the ledger (Story 5.5) and are out of scope here.

> ⚠️ Verify endpoint paths and field names against the current Daraja portal docs at integration time (`https://developer.safaricom.co.ke`). The flow and field semantics below are stable, but confirm before coding.

## 1. Environments & configuration

| Env | Base URL |
|---|---|
| Sandbox | `https://sandbox.safaricom.co.ke` |
| Production | `https://api.safaricom.co.ke` |

Typed config (validated in `packages/shared/env`, secrets via the platform secret store — **never** in the client bundle):

```
MPESA_ENV=sandbox|production
MPESA_BASE_URL=...                 # derived from MPESA_ENV
MPESA_CONSUMER_KEY=...             # secret
MPESA_CONSUMER_SECRET=...          # secret
MPESA_SHORTCODE=...                # Business Short Code / PayBill or Till
MPESA_PASSKEY=...                  # secret (Lipa Na M-Pesa Online passkey)
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline   # or CustomerBuyGoodsOnline for Till
MPESA_CALLBACK_URL=https://<api-host>/api/v1/payments/mpesa/callback
MPESA_CALLBACK_TOKEN=...           # secret shared-secret embedded in callback path/header for verification
```

## 2. Authentication (OAuth)

- **Request:** `GET {BASE}/oauth/v1/generate?grant_type=client_credentials`
- **Auth header:** `Authorization: Basic base64(CONSUMER_KEY:CONSUMER_SECRET)`
- **Response:** `{ access_token, expires_in }` (≈ 3599 s).
- **Caching:** cache the token in Redis with a TTL of `expires_in - 60s`; refresh on expiry. Never request a token per payment.

## 3. STK Push — initiation (Story 5.3)

- **Endpoint:** `POST {BASE}/mpesa/stkpush/v1/processrequest`
- **Auth:** `Authorization: Bearer {access_token}`
- **Timestamp:** `YYYYMMDDHHmmss` (Africa/Nairobi).
- **Password:** `base64(MPESA_SHORTCODE + MPESA_PASSKEY + Timestamp)`.
- **Amount:** integer KES (whole shillings). Our ledger stores `amount_cents`; convert with the shared money util — **reject** any amount that is not a whole shilling (M-Pesa has no cents) and record the exact requested amount.

Request body:
```json
{
  "BusinessShortCode": "{SHORTCODE}",
  "Password": "{base64(Shortcode+Passkey+Timestamp)}",
  "Timestamp": "{Timestamp}",
  "TransactionType": "{MPESA_TRANSACTION_TYPE}",
  "Amount": 3500,
  "PartyA": "2547XXXXXXXX",
  "PartyB": "{SHORTCODE}",
  "PhoneNumber": "2547XXXXXXXX",
  "CallBackURL": "{MPESA_CALLBACK_URL}",
  "AccountReference": "{booking.reference}",
  "TransactionDesc": "SommyComfort {booking.reference}"
}
```
- **Phone normalization:** accept `07XXXXXXXX`, `+2547XXXXXXXX`, `2547XXXXXXXX` → normalize to `2547XXXXXXXX`; reject anything else with a 422.
- **Sync response:** `{ MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription, CustomerMessage }`. `ResponseCode == "0"` means the push was accepted (NOT paid).
- **On accept:** create a `payment` row with `status = pending`, `provider = mpesa_stk`, `provider_checkout_request_id = CheckoutRequestID`, `provider_merchant_request_id`, the booking link, and the requested amount. Post **nothing** to the ledger yet.

## 4. Callback — confirmation (Story 5.4)

- **Endpoint we expose:** `POST /api/v1/payments/mpesa/callback` (public, but verified — see Security).
- Daraja posts:
```json
{ "Body": { "stkCallback": {
  "MerchantRequestID": "...",
  "CheckoutRequestID": "...",
  "ResultCode": 0,
  "ResultDesc": "The service request is processed successfully.",
  "CallbackMetadata": { "Item": [
    { "Name": "Amount", "Value": 3500 },
    { "Name": "MpesaReceiptNumber", "Value": "Q....." },
    { "Name": "TransactionDate", "Value": 20260604121530 },
    { "Name": "PhoneNumber", "Value": 2547XXXXXXXX }
  ]}
}}}
```
- **Processing rules:**
  1. **Respond `200` immediately** with `{ "ResultCode": 0, "ResultDesc": "Accepted" }` and process **asynchronously via BullMQ** — do not block the webhook on ledger work.
  2. **Idempotency:** key the job on `CheckoutRequestID`; if the payment is already `confirmed`/`failed`, no-op. Safe on Daraja retries.
  3. **Match:** find the `payment` by `provider_checkout_request_id`. If none, log + flag for reconciliation (do not 4xx Daraja).
  4. **Success (`ResultCode == 0`):** set `status = confirmed`, store `MpesaReceiptNumber`, paid amount, paid phone, paid-at; **post the payment to the ledger** through the shared money util and recompute booking balance; emit `payment.confirmed` (realtime + notification).
  5. **Amount check:** if paid `Amount` ≠ requested amount, still confirm but flag a reconciliation discrepancy (Story 5.8).
  6. **Failure (`ResultCode != 0`, e.g. 1032 cancelled, 1037 timeout, 1 insufficient funds):** set `status = failed`, store `ResultDesc`; emit `payment.failed`; leave booking balance unchanged.

## 5. STK status query (fallback)

If no callback arrives within a timeout (e.g. 90 s), a BullMQ job may poll:
- **Endpoint:** `POST {BASE}/mpesa/stkpushquery/v1/query` with `{ BusinessShortCode, Password, Timestamp, CheckoutRequestID }`.
- Use the returned `ResultCode` to resolve the still-`pending` payment. Cap retries (e.g. 3 over ~5 min) then leave `pending` and flag for manual reconciliation.

## 6. Manual M-Pesa reference (Story 5.5 — offline fallback)

When STK is unavailable or the guest paid out-of-band:
- Receptionist records `provider = mpesa_manual`, the **M-Pesa receipt code** (e.g. `QABC123XYZ`), amount, and phone.
- Posts to the ledger immediately as `confirmed` but with `reconciled = false` so Story 5.8 can match it against the M-Pesa statement later.
- Duplicate receipt codes are rejected (unique constraint on confirmed receipt number).

## 7. Security

- The callback URL embeds the `MPESA_CALLBACK_TOKEN` (path segment or required header) and is rejected if absent/mismatched.
- Optionally allowlist Safaricom callback source IPs at the edge.
- Validate payload shape with a Zod schema before processing; never trust amounts from the client — only from the verified callback or the receptionist's audited manual entry.
- Every confirm/fail/manual entry writes an `audit_log` row (AR9).

## 8. Data touchpoints

Adds to the `payment` model (see `data-model.md`): `provider` (enum: `mpesa_stk`, `mpesa_manual`, `cash`, `card`), `provider_checkout_request_id`, `provider_merchant_request_id`, `provider_receipt_number`, `status` (enum: `pending`, `confirmed`, `failed`, `reversed`), `paid_phone`, `paid_at`, `reconciled`. Money is `amount_cents BIGINT` + `currency`.

## 9. Test plan

- **Sandbox** test MSISDNs + test shortcode/passkey from the Daraja portal.
- Cases: happy path; user-cancel (1032); timeout (1037); insufficient funds; duplicate callback (idempotency); amount mismatch; callback for unknown CheckoutRequestID; token expiry mid-flow; manual-reference duplicate.
- Integration tests stub the Daraja HTTP client; one end-to-end sandbox smoke test behind a flag.

## 10. Open items for confirmation

- PayBill vs Till (BuyGoods) — sets `TransactionType` and `PartyB`. **Decision needed from Brian.**
- Whether partial M-Pesa payments are allowed (split across multiple STK pushes) — current assumption: **yes**, each push is its own `payment` row against the same booking.
- Refund/reversal flow (B2C) is **out of MVP scope**; refunds in R1 are recorded manually against the ledger and settled out-of-band.
