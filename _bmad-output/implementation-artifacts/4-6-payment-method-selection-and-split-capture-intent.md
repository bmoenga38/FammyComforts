---
baseline_commit: 11b2e4d
---

# Story 4.6: Payment method selection and split capture (intent)

Status: done

> **Org-scoped via PUBLIC slug resolution.** Guest routes carry no session; the
> tenant is resolved from `organizations.by_slug` and every read/write filters
> by that orgId (tenant isolation preserved). Backend + web landed together.

## What landed

paymentMethod (mpesa_stk/mpesa_manual/cash/card) + optional paymentSplits[{method, amountCents int64}] recorded on the booking as INTENT; splits validated positive and <= total; NO charge attempted (Epic 5 processes) (FR7, NFR14).

## Verification

Backend: `convex/guestBookings.test.ts` (8 tests — pricing+VAT, availability,
consent/validation, double-booking, cross-tenant rejection, docs, notification
queue, lookup anti-enumeration). Web: lookup + booking-form tests. Full turbo
gate 14/14; production build OK (/book routes dynamic).

## File List
- Backend: `convex/catalog.ts`, `convex/guestBookings.ts`,
  `convex/lib/bookingDomain.ts`, `convex/schema.ts` (guests/guestDocuments/
  bookings/outboundNotifications + organizations.by_slug)
- Web: `src/app/book/[orgSlug]/{page,\[roomId\]/page,lookup/page}.tsx`
