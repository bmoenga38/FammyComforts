---
baseline_commit: a674a8d
---

# Story 9.2: Order creation across channels

Status: done

> **Org-scoped, "Restaurant" area; line prices snapshotted.** Part of the Epics
> 7–10 batch built directly from `epics.md` (commit 5b7ff59).

## What landed

restaurant.createOrder (Restaurant:write) takes a channel (room_service|dine_in|takeaway|bar), optional table/room, and item lines. Each line snapshots the menu item's name + price; the order totals in int64 cents, gets an ORD-XXXXXX number, and starts at status pending. Inactive items and non-positive/fractional quantities are rejected. The kitchen OrderComposer builds orders from active menu items. Schema: orders (FR43).

## Verification

Backend 102/102 incl. restaurant.test.ts (order totals; lane progression; Restaurant:write gate). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/restaurant.ts` (createOrder), `convex/schema.ts` (+orders)
- Web: `src/app/(app)/kitchen/page.tsx` (OrderComposer)
