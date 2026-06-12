---
baseline_commit: 19fc905
---

# Story 5.4: M-Pesa callback processing and confirmation

Status: done

> **Org-scoped; money is int64 cents end-to-end.** Built per
> `mpesa-daraja-integration-spec.md` adapted to Convex multi-tenancy (per-org
> Daraja creds; HTTP action + transactional mutation replace webhook + BullMQ).

## What landed

HTTP route /mpesa/callback/<token> (per-org shared token verified against the payment's org) → transactional internal mutation: idempotent on CheckoutRequestID (Daraja retries no-op), success posts the PAID amount to the ledger + receipt, amount mismatch confirms but flags reconciliation, failures (1032/1037/…) store ResultDesc, unmatched ids logged not 4xx'd. Convex mutation = the queue/transaction layer (adaptation from BullMQ documented) (FR7, NFR14, AR7).

## Verification

Backend 60/60 (12 new in payments.test.ts + 8 pure-Daraja unit tests in
lib/mpesa.test.ts — callback idempotency, mismatch flagging, receipt dedupe,
ledger derivation, portal verification, reconciliation). Web 62/62. Full turbo
gate 14/14; production build OK. Live Daraja round-trip needs real sandbox
creds entered in /admin/payments (admin-side; engine fully tested without).

## File List
- Backend: `convex/lib/{mpesa,ledger}.ts`, `convex/{paymentMethods,payments,mpesa,invoices,guestRequests}.ts`, `convex/http.ts` (callback route), `convex/guestBookings.ts` (charge-on-create, portal), `convex/schema.ts` (6 tables)
- Web: portal (`book/[orgSlug]/lookup`), `book/[orgSlug]/invoice/[invoiceId]`, `(app)/admin/payments`
