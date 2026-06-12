---
baseline_commit: 19fc905
---

# Story 5.5: Manual M-Pesa, cash, and card recording

Status: done

> **Org-scoped; money is int64 cents end-to-end.** Built per
> `mpesa-daraja-integration-spec.md` adapted to Convex multi-tenancy (per-org
> Daraja creds; HTTP action + transactional mutation replace webhook + BullMQ).

## What landed

payments.recordManual (Payments:write, audited): mpesa_manual requires a receipt code (normalized, deduped in-tx), cash/card direct; posts confirmed + reconciled:false to the ledger; balance returns derived (FR24, NFR14).

## Verification

Backend 60/60 (12 new in payments.test.ts + 8 pure-Daraja unit tests in
lib/mpesa.test.ts — callback idempotency, mismatch flagging, receipt dedupe,
ledger derivation, portal verification, reconciliation). Web 62/62. Full turbo
gate 14/14; production build OK. Live Daraja round-trip needs real sandbox
creds entered in /admin/payments (admin-side; engine fully tested without).

## File List
- Backend: `convex/lib/{mpesa,ledger}.ts`, `convex/{paymentMethods,payments,mpesa,invoices,guestRequests}.ts`, `convex/http.ts` (callback route), `convex/guestBookings.ts` (charge-on-create, portal), `convex/schema.ts` (6 tables)
- Web: portal (`book/[orgSlug]/lookup`), `book/[orgSlug]/invoice/[invoiceId]`, `(app)/admin/payments`
