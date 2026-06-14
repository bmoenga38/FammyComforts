---
baseline_commit: 5c97230
---

# Story 7.6: Maintenance and damage reporting

Status: done

> **Org-scoped, "Maintenance" area; damage charges via the Epic 5 ledger.** Part
> of the Epics 7–10 batch built directly from `epics.md` (commit 87913af).

## What landed

maintenance.report records an issue (kind maintenance|damage) with optional photo and notes. Damage tied to a booking + chargeCents posts a POSITIVE ledger adjustment (the guest owes it) and raises a damaged_asset escalation; maintenance can take a room offline (status maintenance). list shows issues with room/reporter/photo; setStatus moves open→in_progress→resolved and resolving frees a blocked room. Schema: maintenanceIssues (FR28, ties FR54).

## Verification

Backend 86/86 (housekeepingR2.test.ts: damage posts positive adjustment + escalation + open issue). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/maintenance.ts`, `convex/lib/ledger.ts`, `convex/lib/escalate.ts`, `convex/schema.ts` (+maintenanceIssues)
- Web: `src/app/(app)/housekeeping/page.tsx` (ReportIssuePanel), `src/app/(app)/operations/page.tsx` (issues queue)
