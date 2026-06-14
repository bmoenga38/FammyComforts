---
baseline_commit: 87913af
---

# Story 8.1: Product catalog

Status: done

> **Org-scoped, "Inventory" area; money is int64 cents (NFR14).** Part of the
> Epics 7–10 batch built directly from `epics.md` (commit a674a8d).

## What landed

inventory.products lists products with search/sort and a live `low` flag (stockQty ≤ reorderLevel). createProduct (Inventory:manage) captures unit, category, cost + optional selling price (int64 cents), reorder level, and active flag; opening stock arrives as an auditable adjustment movement (never a raw write). setProductActive toggles availability. Schema: products (NFR12, NFR14, FR36).

## Verification

Backend 102/102 incl. inventory.test.ts (product + opening stock as audited movement; Inventory:manage/read gates). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/inventory.ts` (products/createProduct/setProductActive), `convex/lib/stock.ts`, `convex/schema.ts` (+products)
- Web: `src/app/(app)/admin/inventory/page.tsx` (ProductsSection)
