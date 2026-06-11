---
baseline_commit: 11b2e4d
---

# Story 4.8: Guest booking lookup

Status: done

> **Org-scoped via PUBLIC slug resolution.** Guest routes carry no session; the
> tenant is resolved from `organizations.by_slug` and every read/write filters
> by that orgId (tenant isolation preserved). Backend + web landed together.

## What landed

guestBookings.lookup: reference PLUS matching phone/email (case-insensitive) -> status, dates, room, total, balance (= total until Epic 5 payments). Mismatch returns the same null as not-found (no enumeration). Web: /book/[orgSlug]/lookup (FR10).

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
