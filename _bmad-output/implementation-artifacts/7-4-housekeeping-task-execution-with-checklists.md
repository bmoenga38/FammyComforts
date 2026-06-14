---
baseline_commit: 5c97230
---

# Story 7.4: Housekeeping task execution with checklists

Status: done

> **Org-scoped, "Housekeeping" area; templates = :manage.** Part of the Epics
> 7–10 batch built directly from `epics.md` (commit 87913af).

## What landed

setStatus supports start/pause/complete/flag/reopen. On first start the room-type checklist is SNAPSHOTTED from checklistTemplates onto the task (per-room-type template wins over the org default), so later template edits never rewrite in-flight tasks. toggleChecklistItem ticks items; completing a clean flips the room to available. getTemplates/setTemplate manage templates from the admin Assets & Checklists tab. Schema: checklistTemplates table + housekeepingTasks.checklist (FR32, FR33).

## Verification

Backend 86/86 (housekeepingR2.test.ts: template snapshot on start, item toggle, completion frees room). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/housekeeping.ts` (setStatus snapshot, toggleChecklistItem, get/setTemplate), `convex/schema.ts` (+checklistTemplates, +checklist)
- Web: `src/app/(app)/housekeeping/page.tsx` (checklist UI, transitions), `src/app/(app)/admin/setup/page.tsx` (Assets & Checklists tab)
