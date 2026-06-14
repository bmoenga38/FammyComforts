---
baseline_commit: 5c97230
---

# Story 7.5: Photo proof and offline task updates

Status: done (offline-queue portion deferred to PWA scope)

> **Org-scoped, "Housekeeping" area; photos via signed storage URLs (NFR7).**
> Part of the Epics 7–10 batch built directly from `epics.md` (commit 87913af).

## What landed

housekeeping.generateUploadUrl issues a Convex signed upload URL; the client POSTs the photo and links it via attachPhoto (housekeepingTasks.photoStorageId); the task list returns a read URL for display. Photo proof/damage capture is complete. The offline-queue-and-sync half of the story (queue local updates, ordered sync on reconnect, pending indicator) remains PWA scope — the app already ships Serwist + an offline banner; per-task offline mutation queueing is gap-listed (NFR3).

## Verification

Backend 86/86 (housekeepingR2.test.ts exercises the task surface incl. photo field). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/housekeeping.ts` (generateUploadUrl, attachPhoto, photoUrl in list), `convex/schema.ts` (+photoStorageId)
- Web: `src/app/(app)/housekeeping/page.tsx` (camera/upload, proof preview)
