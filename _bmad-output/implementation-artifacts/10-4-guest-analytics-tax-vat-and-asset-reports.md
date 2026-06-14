---
baseline_commit: 5b7ff59
---

# Story 10.4: Guest analytics, tax/VAT, and asset reports

Status: done

> **Org-scoped, "Reports" area; tax decomposed at the active rate.** Part of the
> Epics 7–10 batch built directly from `epics.md` (commit 25912a9).

## What landed

reports.guestAnalytics (returning-guest count, top spenders by confirmed spend, nationality mix). reports.taxVat (ledger charges in range are VAT-inclusive; the VAT portion is decomposed at the currently active rate: gross × bps / (10000 + bps), with net = gross − vat). reports.assetsReport (registered assets, damage reports, open damage, damage charged, open maintenance). Backed on /admin/reports (FR52, FR53, FR54).

## Verification

Backend 102/102 incl. reports.test.ts (tax decomposition of VAT-inclusive charges; guest analytics returning + top spenders). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/reports.ts` (guestAnalytics/taxVat/assetsReport), `convex/lib/bookingDomain.ts` (activeTaxBps)
- Web: `src/app/(app)/admin/reports/page.tsx` (Guests, Tax/VAT, Assets tabs)
