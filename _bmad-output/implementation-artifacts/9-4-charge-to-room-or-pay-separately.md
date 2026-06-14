---
baseline_commit: a674a8d
---

# Story 9.4: Charge to room or pay separately

Status: done

> **Org-scoped, "Restaurant" area; room charges via the Epic 5 ledger, separate
> pay via standalone payments (NFR14).** Part of the Epics 7–10 batch built
> directly from `epics.md` (commit 5b7ff59).

## What landed

restaurant.chargeToRoom resolves a checked-in booking by BK- reference and posts the order total as a ledger charge (memo "Restaurant ORD-… (channel)"), then flips the order to paid + links bookingId. restaurant.payOrder takes separate payment (cash/card/manual M-Pesa) by inserting a standalone confirmed payments row (no bookingId) and links paymentId. Both require a served order; room charges require checked-in status (FR45, NFR14).

## Verification

Backend 102/102 incl. restaurant.test.ts (charge-to-room raises booking balance by order total; separate payment records standalone confirmed payment). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/restaurant.ts` (chargeToRoom/payOrder), `convex/lib/ledger.ts`
- Web: `src/app/(app)/kitchen/page.tsx` (settle: charge room / pay now)
