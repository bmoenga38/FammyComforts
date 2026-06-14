---
baseline_commit: 87913af
---

# Story 8.5: Low-stock alerts and usage tracking

Status: done

> **Org-scoped, "Inventory" area; low-stock ties into the 7.8 escalation
> system.** Part of the Epics 7–10 batch built directly from `epics.md`
> (commit a674a8d).

## What landed

inventory.recordUsage (Inventory:write) decrements stock via a usage movement; over-consumption is blocked. The stock gateway raises a low_stock escalation on the DOWNWARD crossing of the reorder level only (deduped while open), so noisy decrements don't flood the dashboard. Restaurant order serving (Epic 9) consumes linked ingredients through the same usage path. Low items also surface on the inventory report (FR40, FR41, ties FR30).

## Verification

Backend 102/102 incl. inventory.test.ts (usage decrements; crossing raises low_stock once; over-consumption rejected). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/lib/stock.ts` (low-stock raise), `convex/inventory.ts` (recordUsage), `convex/lib/escalate.ts`
- Web: `src/app/(app)/admin/inventory/page.tsx` (low badge, Use action)
