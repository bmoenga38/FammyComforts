---
baseline_commit: 5b7ff59
---

# Story 10.6: Multi-channel notifications

Status: done

> **Org-scoped, "Notifications" area; own-SenderID SMS (two-layer model), honest
> pending state.** Part of the Epics 7–10 batch built directly from `epics.md`
> (commit 25912a9; engine code shipped with the Epic 7 commit 87913af, cron + UI
> completed here).

## What landed

notificationsEngine drains the outboundNotifications queue on a 5-minute cron. Rows are enqueued by booking/payment/assignment flows already honoring per-org notificationSettings at queue time. push rows are in-app (the live bell feed delivered them) → marked sent. sms rows POST to the property's own gateway (SMS_GATEWAY_URL + SMS_API_KEY; SMS_SENDER_ID defaults "FammyComfort"), up to 3 attempts then failed with the last error. email/whatsapp (and sms with no gateway configured) stay queued — honest pending, never fake-sent. Schema: outboundNotifications gains recipient/body/attempts/sentAt/error (FR56, NFR4).

## Verification

Backend 102/102 incl. reports.test.ts notification-engine suite (push → sent; sms retries to 3 then failed; terminal rows not reprocessed). Web 72/72. tsc clean; production build OK.

## File List
- Backend: `convex/notificationsEngine.ts` (listQueued/markResult/drain), `convex/crons.ts` (5-min drain), `convex/schema.ts` (outboundNotifications fields), enqueue sites in `convex/{housekeeping,guestBookings}.ts`
- Web: `src/components/shell/notifications-bell.tsx` (live feed)
