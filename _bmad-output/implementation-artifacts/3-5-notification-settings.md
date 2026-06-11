---
baseline_commit: ecb8ad1
---

# Story 3.5: Notification settings

Status: done

> **Org-scoped, "Notifications" area.** Backend landed + tested; web admin deferred.

## Story
As an admin, I want to configure which notifications are enabled and their
channels, so that the property controls guest/staff messaging. (FR13, ties FR56)

## Acceptance Criteria
1. Enable/disable a notification `type` on a `channel` (email/sms/whatsapp/push);
   the preference is stored (one row per type+channel) and respected by the
   notification engine (later epics). Org-scoped + audited.
2. `setEnabled` upserts (no duplicate rows) and is idempotent (same value → no-op).
3. Writes need `Notifications:manage`.

## Tasks
- [x] schema: `notificationSettings` (orgId, type, channel, enabled) with
      by_org / by_org_type_channel.
- [x] `notifications.ts`: list + setEnabled (upsert, gated, audited).
- [x] tests in `rates.test.ts` (idempotent toggle, gating). Backend 35/35; gate green.
- [x] Web: Notifications tab of `/admin/setup` (type × channel grid).

## Dev Agent Record
### File List
- Added: `convex/notifications.ts` (+ tests in `rates.test.ts`)
- Modified: `convex/schema.ts` (+notificationSettings)
