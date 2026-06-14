---
baseline_commit: 87913af
---

# Story 8.4: Stocktake

Status: done

> **Org-scoped, "Inventory" area; variances post through the stock gateway.**
> Part of the Epics 7–10 batch built directly from `epics.md` (commit a674a8d).

## What landed

inventory.stocktake (Inventory:manage) takes counted quantities per product; each non-zero variance (counted − system) posts a stocktake stock movement so on-hand reconciles to the count and the adjustment stays auditable. A single audit row records counted/variance totals. The admin inventory "Start stocktake" mode turns the product table into count-entry fields; blank rows keep the system figure (FR39, FR38).

## Verification

Backend 102/102 incl. inventory.test.ts (stocktake posts variance, corrects on-hand). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/inventory.ts` (stocktake), `convex/lib/stock.ts`, `convex/schema.ts`
- Web: `src/app/(app)/admin/inventory/page.tsx` (stocktake mode)
