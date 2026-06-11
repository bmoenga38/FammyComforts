---
baseline_commit: ecb8ad1
---

# Story 3.4: Rate plans and tax

Status: in-progress

> **Org-scoped, "Settings" area.** Backend landed + tested; web admin deferred.

## Story
As an admin, I want to set nightly rates and tax/VAT, so that bookings price
correctly. (FR13, NFR14)

## Acceptance Criteria
1. Create rate plans tied to a room type with `nightlyCents` (**int64 minor
   units, never floats**), currency default `KES`, active flag — org-scoped +
   audited. Negative money rejected.
2. Create tax rules with a fractional `rate` (0.16 = 16%); rate validated to
   `[0,1]`. Availability/booking math (Epic 4/5) reads these.
3. Writes need `Settings:manage`; cross-org room-type refs rejected.

## Tasks
- [x] schema: `ratePlans` (int64 nightlyCents, currency, active) + `taxRules`
      (fractional rate, active), by_org / by_roomType.
- [x] `rates.ts`: list/create/update for rate plans + tax rules, gated + audited,
      money + tax-range validation.
- [x] tests in `rates.test.ts`. Backend 35/35; full turbo gate green.
- [ ] Web rates/tax admin. *(web batch)*

## Dev Agent Record
### File List
- Added: `convex/rates.ts` (+ tests in `rates.test.ts`)
- Modified: `convex/schema.ts` (+ratePlans/taxRules)
