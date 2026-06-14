---
baseline_commit: 5c97230
---

# Story 7.2: Room-readiness board

Status: done

> **Org-scoped, "Rooms"/"Housekeeping" areas; realtime via Convex.** Part of the
> Epics 7–10 batch built directly from `epics.md` (commit 87913af).

## What landed

Rooms expose the full status set (available/occupied/dirty/cleaning/maintenance/blocked) on the front-desk Rooms panel and the ops view. Authorized status changes broadcast live to other users through Convex subscriptions. Lifecycle automation keeps the board honest: checkout flips a room to dirty + queues a cleaning task; completing that clean (housekeeping.setStatus) frees the room back to available; reporting maintenance can take a room offline and resolving it restores availability (FR26, NFR10).

## Verification

Backend 86/86 (housekeepingR2.test.ts asserts completed clean returns the room to available; deskBookings.test.ts covers checkout→dirty). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/housekeeping.ts` (setStatus frees room), `convex/maintenance.ts` (block/restore), `convex/rooms.ts`, `convex/deskBookings.ts`
- Web: `src/app/(app)/front-desk/page.tsx` (room panel), `src/app/(app)/operations/page.tsx`
