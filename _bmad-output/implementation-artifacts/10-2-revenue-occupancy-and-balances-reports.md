---
baseline_commit: 5b7ff59
---

# Story 10.2: Revenue, occupancy, and balances reports

Status: done

> **Org-scoped, "Reports" area; every figure traces to source rows (NFR12).**
> Part of the Epics 7–10 batch built directly from `epics.md` (commit 25912a9).

## What landed

reports.revenue (confirmed payments over an inclusive range, by day/method/source). reports.occupancy (daily occupied count + pct from non-cancelled bookings, average occupancy, and average length of stay). reports.balances (open balances across non-cancelled bookings, each derived from the ledger, with an outstanding total). Ranges are validated and capped at 366 days. Backed on /admin/reports with date pickers (FR47, FR48, FR49, NFR12).

## Verification

Backend 102/102 incl. reports.test.ts (revenue by method/source; balances trace open remainder; occupancy days + ALOS). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/reports.ts` (revenue/occupancy/balances), `convex/lib/{ledger,bookingDomain}.ts`
- Web: `src/app/(app)/admin/reports/page.tsx` (Revenue/Occupancy/Balances tabs)
