---
baseline_commit: a674a8d
---

# Story 9.3: Kitchen display with status lanes

Status: done

> **Org-scoped, "Restaurant" area; realtime via Convex subscriptions (NFR10).**
> Part of the Epics 7–10 batch built directly from `epics.md` (commit 5b7ff59).

## What landed

restaurant.board feeds a live kitchen display; setOrderStatus enforces forward-only lanes (pending → preparing → ready → served), with cancel allowed any time before paid (paid only via settlement, 9.4). Moving an order to served posts usage stock movements for each linked ingredient — best-effort: a missing link or short stock never blocks service, shortfalls are audited. Changes broadcast to all clients within Convex's realtime window. Lane card actions advance/cancel/settle (FR44, NFR10).

## Verification

Backend 102/102 incl. restaurant.test.ts (lanes enforced; serving consumes linked stock; out-of-order transition rejected). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/restaurant.ts` (board/setOrderStatus + serve-usage), `convex/lib/stock.ts`
- Web: `src/app/(app)/kitchen/page.tsx` (lane board, OrderCard)
