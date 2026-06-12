# FammyComfort — MVP Deployment & Go-Live Checklist

State at writing: Convex **prod is live** (`notable-cod-441`, all Epic 1–6
functions deployed, health ok). What's missing is the **public web app** and the
end-to-end walk-through. This file is the runbook.

## 1. Deploy `apps/web` to Vercel (manual — needs the Vercel account)

1. vercel.com → **Add New Project** → import `bmoenga38/FammyComforts`.
2. **Project name:** `fammycomforts` (if free, the URL becomes
   `https://fammycomforts.vercel.app`, which prod `SITE_URL` already points to).
3. **Root Directory:** `apps/web` (leave "Include files outside root" ON).
4. Framework: Next.js (auto). Build command comes from `apps/web/vercel.json`
   (`cd ../.. && pnpm turbo build --filter=@fammycomforts/web` — builds
   `packages/shared` first). Install command: leave default (pnpm workspace).
5. **Environment variables** (Production):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_CONVEX_URL` | `https://notable-cod-441.convex.cloud` |
   | `NEXT_PUBLIC_BYTEPLANE_URL` | `https://bytebazaar-plane.vercel.app` |
6. Deploy. Note the final URL.

> Turbo note: `turbo.json` declares `"env": ["NEXT_PUBLIC_*"]` on the build
> task — required, or strict env mode strips these vars on Vercel.

## 2. Post-deploy wiring (CLI — Claude does this)

- If the URL is **not** `https://fammycomforts.vercel.app`, update Convex prod:
  `npx convex env set SITE_URL <real-url> --prod` (from `packages/backend`).
- Bytebazaar prod (their repo/Vercel): set `NEXT_PUBLIC_BYTESTAY_URL` =
  the FammyComfort web URL, so the BytePlane tile launches it.

## 3. End-to-end smoke walk-through (manual, ~15 min)

Pairing rule: prod tile ↔ prod FammyComfort (handoffs verify only in the
deployment that minted them).

1. **SSO:** BytePlane (prod) → ByteStay tile → should land
   `<web>/sso?token=…` → signed-in session. ✅ = Story 2.1 closed live.
2. **Setup:** `/admin/setup` → create property (times, ID policy), branch,
   room type + amenities, rooms, rate plan (KES), VAT rule; enable
   `booking_confirmation` SMS in Notifications.
3. **Access:** `/admin/access` → confirm your role/permissions render.
4. **Guest booking:** open `<web>/book/<org-slug>` in an incognito window →
   search dates → book a room (consent, M-Pesa intent) → BK- reference shown.
5. **Front desk:** `/front-desk` → pending booking appears → Confirm →
   Check in (ID verified) → record a cash payment → Check out (asset check) —
   balance gate should block if underpaid. Housekeeping task created.
6. **Portal:** `/book/<slug>/lookup` with reference + phone → balance,
   payments, receipt (Issue receipt from the desk first), submit a request →
   visible in `/admin/payments`.
7. **M-Pesa sandbox (optional now):** `/admin/payments` → enter Daraja
   sandbox creds (shortcode 174379 + portal passkey/keys) → register the
   callback URL `https://notable-cod-441.convex.site/mpesa/callback/<token>`
   (token shown in the UI) → STK push from the portal with a sandbox MSISDN.

## 4. Known-remaining after go-live

- `(staff)` route guard (unauthenticated → `/signin`) — deferred from 2.3.
- Server-side PDF rendering (print-to-PDF works).
- STK status-query fallback poller (unanswered pushes stay pending →
  reconciliation view catches them).
- Real production Daraja credentials when the business is ready.
