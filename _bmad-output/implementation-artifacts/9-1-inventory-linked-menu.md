---
baseline_commit: a674a8d
---

# Story 9.1: Inventory-linked menu

Status: done

> **Org-scoped, "Restaurant" area; serving consumes Epic 8 inventory.** Part of
> the Epics 7–10 batch built directly from `epics.md` (commit 5b7ff59).

## What landed

restaurant.createMenuItem (Restaurant:manage) creates menu items with price (int64 cents), category, and an OPTIONAL ingredient list linking inventory products with a per-serving qty. menu lists items with resolved ingredient names; setMenuItemActive 86s/restores an item. Selling a linked item records usage against the inventory product when the order is served (see 9.3), closing the loop to Epic 8 (FR42, FR41). Schema: menuItems.

## Verification

Backend 102/102 incl. restaurant.test.ts (linked item consumes stock on serve; Restaurant:manage gate). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/restaurant.ts` (menu/createMenuItem/setMenuItemActive), `convex/schema.ts` (+menuItems)
- Web: `src/app/(app)/kitchen/page.tsx` (MenuManager, inventory link)
