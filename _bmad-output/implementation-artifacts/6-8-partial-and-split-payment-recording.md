---
baseline_commit: f094f1f
---

# Story 6.8: Partial and split payment recording

Status: done

> **Org-scoped, "Bookings"/"Guests"/"Payments" areas; all money via the Epic 5
> ledger.** Includes the epic-wide ledger sign-convention fix: refund entries are
> POSITIVE (money returned raises the open balance); adjustments may be either
> sign; receipts list payments only.

## What landed

Multiple payments across methods per booking via payments.recordManual (Epic 5 engine — receipt dedupe, reconciled:false); balance recalculates exactly from the ledger; per-booking Record-payment form on the /front-desk board (FR24, NFR14).

## Verification

Backend 68/68 (8 new in deskBookings.test.ts — lifecycle incl. ID gate, balance
gate + exception, damage charge in the final balance, housekeeping trigger,
exact extension pricing, extension conflicts, same-type room change, cancel
waiver, refund sign, no-show, calendar spans + cap, permission gating). Web
65/65 incl. front-desk gating. Full turbo gate 14/14; production build OK.

## File List
- Backend: `convex/deskBookings.ts`, `convex/guests.ts`, `convex/calendar.ts`,
  `convex/lib/ledger.ts` (sign fix), `convex/invoices.ts` (receipt lines),
  `convex/schema.ts` (+housekeepingTasks)
- Web: `src/app/(app)/front-desk/page.tsx` (Today board / Calendar / New booking / Guests)
