---
baseline_commit: 5c97230
---

# Story 7.8: Operational escalations

Status: done

> **Org-scoped, "Dashboard" read / "Maintenance" resolve; deduped per
> (trigger, entity).** Part of the Epics 7–10 batch built directly from
> `epics.md` (commit 87913af).

## What landed

lib/escalate.raiseEscalation is the single dedup gateway (one OPEN escalation per trigger+entity). Event triggers fire inline: failed M-Pesa payment (mpesa callback), missing/damaged asset (assets/maintenance), low stock (lib/stock). Time-based triggers run via an hourly cron (escalations.sweep): dirty room past 4h SLA, in-house bookings owing at/after departure. escalations.list surfaces open items on the ops dashboard + the notification feed (Dashboard:read); resolve closes them (Maintenance:write). Schema: escalations; crons.ts hourly job (FR30, NFR10, ties FR56).

## Verification

Backend 86/86 (housekeepingR2.test.ts: hourly sweep raises unpaid-balance, dedup on re-sweep, resolve closes). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/lib/escalate.ts`, `convex/escalations.ts`, `convex/crons.ts` (hourly sweep), `convex/mpesa.ts` (failed trigger), `convex/notificationsFeed.ts` (escalation items), `convex/schema.ts` (+escalations)
- Web: `src/app/(app)/operations/page.tsx` (escalation queue + resolve)
