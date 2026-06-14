---
baseline_commit: 5c97230
---

# Story 7.7: Per-room asset checklist and checkout verification

Status: done

> **Org-scoped, "Assets" area; discrepancy charges via the Epic 5 ledger.** Part
> of the Epics 7–10 batch built directly from `epics.md` (commit 87913af).

## What landed

assets.add/remove/listByRoom maintain a per-room asset registry (admin Assets & Checklists tab). assets.verifyCheckout takes one result per asset (present/missing/damaged); each discrepancy creates a damage maintenanceIssue + escalation (missing_asset/damaged_asset) and, with an optional per-asset chargeCents, posts a positive ledger adjustment BEFORE the balance gate. deskBookings board now exposes roomId so the desk checkout flow can run the per-asset check. Schema: roomAssets (FR29, ties FR54).

## Verification

Backend 86/86 (housekeepingR2.test.ts: registry + checkout verify charges & escalates discrepancies). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/assets.ts`, `convex/deskBookings.ts` (+roomId on board), `convex/lib/{ledger,escalate}.ts`, `convex/schema.ts` (+roomAssets)
- Web: `src/app/(app)/front-desk/page.tsx` (AssetCheckBlock), `src/app/(app)/admin/setup/page.tsx` (asset registry)
