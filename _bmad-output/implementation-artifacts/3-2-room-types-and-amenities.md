---
baseline_commit: ecb8ad1
---

# Story 3.2: Room types and amenities

Status: done

> **Org-scoped, "Rooms" area.** Backend landed + tested; web admin deferred to
> the web batch.

## Story
As an admin, I want to manage room types and amenities, so that rooms can be
categorized and described consistently. (FR13)

## Acceptance Criteria
1. Create amenities (unique name per org) and room types (name, capacity ≥ 1,
   optional size) with a set of amenities; all org-scoped + audited.
2. `roomTypes.list` resolves amenity names; reads need an authenticated org user.
3. Writes need `Rooms:manage`; a room type in use by rooms can't be deleted;
   removing an amenity detaches it from types. Cross-org refs rejected.

## Tasks
- [x] schema: `amenities`, `roomTypes`, `roomTypeAmenities` (by_org / by_roomType).
- [x] `amenities.ts` (list/create/remove) + `roomTypes.ts`
      (list-with-amenities/create/update/remove, in-use guard).
- [x] tests in `rooms.test.ts` (amenities + types). Backend 31/31; gate green.
- [x] Web: Room types tab of `/admin/setup`.

## Dev Agent Record
### File List
- Added: `convex/amenities.ts`, `convex/roomTypes.ts` (+ tests in `rooms.test.ts`)
- Modified: `convex/schema.ts` (+amenities/roomTypes/roomTypeAmenities)
