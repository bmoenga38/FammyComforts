---
baseline_commit: a674a8d
---

# Story 9.5: Restaurant revenue and top-sellers

Status: done

> **Org-scoped, "Restaurant" area; aggregates settled orders.** Part of the
> Epics 7–10 batch built directly from `epics.md` (commit 5b7ff59).

## What landed

restaurant.revenue takes an inclusive date range and aggregates paid orders into a total, a per-channel breakdown, and a top-sellers list (by quantity, from snapshotted line items). The kitchen RevenueCard shows today's settled total + leading item; the admin reports layer (10.x) reuses the same source records for the broader view (FR46, ties Epic 10).

## Verification

Backend 102/102 incl. restaurant.test.ts (revenue total + top sellers over a date range). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/restaurant.ts` (revenue)
- Web: `src/app/(app)/kitchen/page.tsx` (RevenueCard)
