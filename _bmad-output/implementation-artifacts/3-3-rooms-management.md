---
baseline_commit: ecb8ad1
---

# Story 3.3: Rooms management

Status: in-progress

> **Org-scoped, "Rooms" area.** Backend landed + tested; web admin deferred.

## Story
As an admin, I want to create and manage individual rooms, so that real units
exist to book and operate. (FR13)

## Acceptance Criteria
1. Add a room with number, floor, branch + room type (both validated in-org) and
   an initial `status` (default `available`) — appears in `rooms.list` with type
   and branch names resolved. Number is unique per branch.
2. `setStatus` transitions the RoomStatus enum (available/occupied/dirty/
   cleaning/maintenance/blocked); update/remove supported. All audited.
3. Writes need `Rooms:manage`; cross-org branch/type refs rejected.

## Tasks
- [x] schema: `rooms` (orgId, branchId, roomTypeId, number, floor?, status) with
      by_org / by_branch / by_roomType / by_branch_number.
- [x] `rooms.ts`: list (resolved names) / create (unique number) / update /
      setStatus / remove — gated + audited.
- [x] tests in `rooms.test.ts` (unique number, status, cross-org, gating).
      Backend 31/31; full turbo gate green.
- [ ] Web rooms admin. *(web batch)*

## Dev Agent Record
### File List
- Added: `convex/rooms.ts` (+ tests in `rooms.test.ts`)
- Modified: `convex/schema.ts` (+rooms)
