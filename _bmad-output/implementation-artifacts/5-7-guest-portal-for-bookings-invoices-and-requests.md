---
baseline_commit: 19fc905
---

# Story 5.7: Guest portal for bookings, invoices, and requests

Status: done

> **Org-scoped; money is int64 cents end-to-end.** Built per
> `mpesa-daraja-integration-spec.md` adapted to Convex multi-tenancy (per-org
> Daraja creds; HTTP action + transactional mutation replace webhook + BullMQ).

## What landed

guestBookings.portal (verified reference+contact): status, derived balance, payments, invoices, requests. guestRequests.submit (public, verified, 1000-char cap) → staff queue listForOrg (Bookings:read) + resolve (Bookings:write, audited) surfaced in /admin/payments — R2 ops workspace ships later. Portal page upgraded with pay box + request box (FR11).

## Verification

Backend 60/60 (12 new in payments.test.ts + 8 pure-Daraja unit tests in
lib/mpesa.test.ts — callback idempotency, mismatch flagging, receipt dedupe,
ledger derivation, portal verification, reconciliation). Web 62/62. Full turbo
gate 14/14; production build OK. Live Daraja round-trip needs real sandbox
creds entered in /admin/payments (admin-side; engine fully tested without).

## File List
- Backend: `convex/lib/{mpesa,ledger}.ts`, `convex/{paymentMethods,payments,mpesa,invoices,guestRequests}.ts`, `convex/http.ts` (callback route), `convex/guestBookings.ts` (charge-on-create, portal), `convex/schema.ts` (6 tables)
- Web: portal (`book/[orgSlug]/lookup`), `book/[orgSlug]/invoice/[invoiceId]`, `(app)/admin/payments`
