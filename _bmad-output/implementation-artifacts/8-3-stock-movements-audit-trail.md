---
baseline_commit: 87913af
---

# Story 8.3: Stock movements audit trail

Status: done

> **Org-scoped, "Inventory" area; single mutation gateway — on-hand can never
> drift.** Part of the Epics 7–10 batch built directly from `epics.md`
> (commit a674a8d).

## What landed

lib/stock.applyStockMovement is the ONLY path that changes a product's on-hand: it patches stockQty, writes an immutable stockMovements row (product, signed deltaQty, reason purchase|usage|adjustment|stocktake, refType/refId, actor + timestamp), blocks negative stock, and fires the low-stock escalation on a downward crossing. Every caller (opening stock, PO receive, usage, stocktake, restaurant serving) goes through it. inventory.movements returns the trail. Schema: stockMovements (FR38).

## Verification

Backend 102/102 incl. inventory.test.ts (opening stock + variance + usage all produce movement rows with correct sign/reason/actor). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/lib/stock.ts` (gateway), `convex/inventory.ts` (movements query), `convex/schema.ts` (+stockMovements)
- Web: `src/app/(app)/admin/inventory/page.tsx` (MovementsSection)
