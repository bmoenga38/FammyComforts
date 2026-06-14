---
baseline_commit: 5c97230
---

# Story 7.1: Mobile daily-operations dashboard

Status: done

> **Org-scoped, "Dashboard" area; everything derived live from records — no
> stored aggregates.** Part of the Epics 7–10 batch built directly from
> `epics.md` (commit 87913af).

## What landed

opsDashboard.summary extended for the ops manager view: arrivals/departures today, in-house count, occupancy from room statuses, pending tasks + open requests, plus the R2 additions — outstanding balances across active stays (ledger-derived), late checkouts (in-house past departure), and open escalations. Revenue today + last-7-days buckets and forward 7-day occupancy projection retained. Surfaced on /operations with KPI tiles updating in near-real-time via Convex subscriptions (FR25, NFR10, UX-DR6).

## Verification

Backend 86/86 after epic (opsDashboard.test.ts: derived occupancy/counts/revenue + Dashboard:read gate). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/opsDashboard.ts` (outstanding/late/escalations), `convex/lib/ledger.ts` (balance derivation)
- Web: `src/app/(app)/operations/page.tsx` (KPI tiles, charts)
