---
baseline_commit: f094f1f
---

# Story 6.7: Booking modifications

Status: done

> **Org-scoped, "Bookings"/"Guests"/"Payments" areas; all money via the Epic 5
> ledger.** Includes the epic-wide ledger sign-convention fix: refund entries are
> POSITIVE (money returned raises the open balance); adjustments may be either
> sign; receipts list payments only.

## What landed

extend (extension-window conflict check, exact delta at the booking's plan + current tax, charge posted, totals updated); changeRoom (same room type in R1 — keeps money exact; occupied/dirty status follows); cancel (waives open balance via adjustment by default, reason audited); markNoShow (charges stay); refund (POSITIVE ledger entry — sign convention fixed this epic: refunds raise the open balance; settled out-of-band per Daraja spec §10). All audited (FR23, FR17, NFR14).

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
