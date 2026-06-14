---
baseline_commit: 87913af
---

# Story 8.2: Suppliers and purchase orders

Status: done

> **Org-scoped, "Purchases" area; restock only via the stock gateway.** Part of
> the Epics 7–10 batch built directly from `epics.md` (commit a674a8d).

## What landed

suppliers/createSupplier (Purchases:manage). createPurchaseOrder (Purchases:write) snapshots line names + unit costs and totals them (status "ordered"). receivePurchaseOrder increases stock through applyStockMovement (reason purchase) and flips status to received with receivedAt; double-receive and receiving a cancelled PO are rejected. cancelPurchaseOrder voids an ordered/draft PO. Schema: suppliers, purchaseOrders (FR37, FR38).

## Verification

Backend 102/102 incl. inventory.test.ts (PO create totals; receive restocks; double-receive blocked). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/inventory.ts` (suppliers/POs/receive/cancel), `convex/lib/stock.ts`, `convex/schema.ts` (+suppliers, +purchaseOrders)
- Web: `src/app/(app)/admin/inventory/page.tsx` (PurchasesSection)
