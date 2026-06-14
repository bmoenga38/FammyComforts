---
baseline_commit: 5b7ff59
---

# Story 10.1: Admin KPI dashboard and action queue

Status: done

> **Org-scoped, "Dashboard" area; everything derived live (NFR10).** Part of the
> Epics 7–10 batch built directly from `epics.md` (commit 25912a9).

## What landed

opsDashboard.summary gains restaurantTodayCents (settled orders today) alongside occupancy, revenue, outstanding balances, check-ins/outs, in-house, housekeeping, and escalation counts. The admin overview shows the KPI row plus a daily action queue — open escalations, late checkouts, arrivals to check in, pending cleaning tasks, open guest requests — each a deep link to the workspace that resolves it. Updates near-real-time via Convex (FR12, NFR10).

## Verification

Backend 102/102 (opsDashboard.test.ts + reports.test.ts). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/opsDashboard.ts` (+restaurantTodayCents)
- Web: `src/app/(app)/admin/page.tsx` (KPI row, ActionQueue)
