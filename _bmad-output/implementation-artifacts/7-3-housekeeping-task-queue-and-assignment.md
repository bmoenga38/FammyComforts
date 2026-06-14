---
baseline_commit: 5c97230
---

# Story 7.3: Housekeeping task queue and assignment

Status: done

> **Org-scoped, "Housekeeping" area; assignment = :manage, execution = :write.**
> Part of the Epics 7–10 batch built directly from `epics.md` (commit 87913af).

## What landed

housekeeping.create (manual task for a dirty room or ad-hoc need) and housekeeping.assign (set assignee + priority, ops manager). Tasks list priority-sorted; an All/Mine filter scopes to the caller. Assignment queues a task_assignment outboundNotification (→ bell feed + SMS engine, FR56). assignees query backs the picker. Schema: housekeepingTasks gains assigneeId + by_assignee index (FR27, FR31).

## Verification

Backend 86/86 (housekeepingR2.test.ts: create+assign, assignment notice queued, Housekeeping:manage gate). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/housekeeping.ts` (create/assign/assignees), `convex/schema.ts` (+assigneeId, by_assignee)
- Web: `src/app/(app)/housekeeping/page.tsx` (CreateTaskPanel, assignment select, All/Mine)
