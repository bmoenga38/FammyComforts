---
baseline_commit: 5b7ff59
---

# Story 10.3: Profit & loss and inventory reports

Status: done

> **Org-scoped, "Reports" area; computed from payments + POs + stock.** Part of
> the Epics 7–10 batch built directly from `epics.md` (commit 25912a9).

## What landed

reports.pnl: a simple trading view — confirmed revenue minus received purchase orders over a range (purchaseOrders gains receivedAt so purchases bucket by receipt date). reports.inventoryReport: stock value at cost, low-stock list, total movements, and top usage (from usage movements). Payroll/other operating expenses are out of scope for R1 data (noted in the UI). Backed on /admin/reports (FR50, FR51).

## Verification

Backend 102/102 incl. reports.test.ts (P&L subtracts received POs; inventory stock value). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/reports.ts` (pnl/inventoryReport), `convex/inventory.ts` (receivedAt on receive), `convex/schema.ts` (+receivedAt)
- Web: `src/app/(app)/admin/reports/page.tsx` (P&L, Inventory tabs)
