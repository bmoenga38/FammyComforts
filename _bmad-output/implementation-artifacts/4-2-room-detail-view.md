---
baseline_commit: 11b2e4d
---

# Story 4.2: Room detail view

Status: done

> **Org-scoped via PUBLIC slug resolution.** Guest routes carry no session; the
> tenant is resolved from `organizations.by_slug` and every read/write filters
> by that orgId (tenant isolation preserved). Backend + web landed together.

## What landed

catalog.roomDetail: amenities, capacity, floor, number, size, location, pricing, availability + property policy (check-in/out, cancellation note, ID requirement). Web: /book/[orgSlug]/[roomId]. Gallery deferred until real photos exist (FR2).

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
