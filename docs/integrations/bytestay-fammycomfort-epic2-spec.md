# ByteStay (FammyComfort) ⇄ Bytebazaar — Epic 2 Integration Spec

> **Mirror provenance.** This is the FammyComfort-repo copy of the locked
> integration direction. The authoring copy lives in the Bytebazaar repo at
> `C:\Bytebazaar\docs\integrations\bytestay-fammycomfort-epic2-spec.md`. Per
> Section 6.4 this file is **FammyComfort's Epic 2 source of truth**; keep the
> two in sync when the contract changes (the env-var names in Section 5 are the
> integration boundary — change them in both repos together).

Status: **Pre-build direction.** Foundation slice (orgId + identity cache)
buildable now; live SSO round-trip gated on the shared secret + BB-1..BB-3.
Decisions locked: **self-serve** onboarding, **full** platform bridge
(SSO + SMS + M-Pesa collect + B2C payouts), **spec-first**.

> Naming: internal product **slug = `rental`** (stable, no data migration),
> brand/display = **ByteStay**, standalone app/repo = **FammyComfort**.
> All new env vars use the `BYTESTAY` token to match the brand.

---

## 1. Why this is a small integration
The platform-side SSO and service bridge already exist and are
product-agnostic. FammyComfort is a *consumer* of contracts that are
already shipped, not a new platform feature.

- **SSO handoff** — `convex/sso.ts` is generic: `issueHandoff` →
  `verifyHandoff` → `consumeHandoff` over the shared `handoffs` table.
  It already checks the org owns the product and it's active.
- **Catalog** — `rental`/ByteStay is registered (`requiresReview: false`).
- **Service bridge pattern** — `convex/bridge/taskshub.ts` +
  `convex/bridge/queries.ts` show the exact shape to mirror.

The integration contract = `verifyHandoff`'s return value:
`{ orgId, userId, productSlug, org{_id,name,slug}, user{name,phone,email,role} }`.

---

## 2. The one non-negotiable
**Every FammyComfort Convex table carries `orgId` from Story 2.1 onward**,
with a `by_org*` index, and **every query/mutation filters by the
SSO-resolved `orgId`**. Deferring this is the only decision that forces a
painful backfill later. No table ships without it.

---

## 3. Bytebazaar-side work (small, do once)
These make ByteStay buyable + launchable + serviceable. All in the
**Bytebazaar** repo (`C:\Bytebazaar`), not here.

| # | Change | File | Notes |
|---|--------|------|-------|
| BB-1 | Launcher tile → external SSO app | `apps/plane/src/lib/product-meta.ts` | `rental`: set `external:true, externalUrlEnv:"NEXT_PUBLIC_BYTESTAY_URL", route:null, mounted:true` (currently an internal stub). |
| BB-2 | Build env passthrough | `turbo.json` + Vercel | Add `NEXT_PUBLIC_BYTESTAY_URL`. |
| BB-3 | SSO token prefix | `convex/sso.ts` | Add `rental: "bys_"` to `TOKEN_PREFIXES` (fallback works without it, but register for clarity). |
| BB-4 | Service bridge module | new `convex/bridge/bytestay.ts` | Mirror `bridge/taskshub.ts`: `notifySend`, `checkFloat`, `disburseB2c`, `_notifyByteStayPaid`, `_notifyByteStayPayoutFailed`. Auth via `BYTEBAZAAR_SERVICE_TOKEN_BYTESTAY`. |
| BB-5 | Payout-callback routing | `convex/pay/callbacks.ts` | Recognize `bystay-payout-<id>` idempotency keys and dispatch to the ByteStay notify actions (mirrors the `task-payout-<taskId>` path). |
| BB-6 | Catalog | — | **No change** — already `requiresReview: false`. |

Reuse note: `notifySend`/`checkFloat`/`disburseB2c` in `bridge/taskshub.ts`
are nearly generic. Consider refactoring the shared parts into a single
product-keyed bridge instead of copy-paste — but mirroring first (then
extracting) is the lower-risk path.

---

## 4. FammyComfort-side work = Epic 2 (the real build)

### Story 2.1 — Staff Authentication via ByteAuth SSO  ⟵ start here
The foundation everything else depends on.
- Add `orgId` to the schema convention (Section 2) — apply to all tables.
- Identity-cache tables: `organizations` (cache of Bytebazaar org: id, name,
  slug) and `users` (id, name, phone, email, role, `bytebazaarUserId`,
  `orgId`). Populated on first SSO.
- `/sso` route in `apps/web`:
  1. read `?token=`,
  2. call Bytebazaar `api.sso.verifyHandoff(token)`,
  3. upsert org/user into the identity cache,
  4. mint a FammyComfort session,
  5. call `api.sso.consumeHandoff(token)`,
  6. redirect into the app.
- `@convex-dev/auth` for the FammyComfort-side session.
- **AC:** clicking the ByteStay tile in BytePlane lands an authenticated,
  org-scoped FammyComfort session; expired/used/forged tokens are rejected;
  a second tenant cannot see the first's data.

### Story 2.2 — ByteComms SMS (booking confirmations)
- Call Bytebazaar `bridge.bytestay.notifySend` with the service token for
  booking/check-in/reminder SMS, using the org's `orgId`.
- **AC:** a booking action sends an SMS through ByteComms; failures are
  logged, never block the booking.

### Story 2.3 — BytePay M-Pesa collect (guest payments)
- STK push for guest payments via the bridge; handle the callback to mark
  the booking paid (idempotent).
- **AC:** a guest pays by M-Pesa; the booking flips to paid exactly once.

### Story 2.4 — BytePay B2C payouts + status callbacks
- Float pre-check via `bridge.bytestay.checkFloat` before payout.
- Disburse via `bridge.bytestay.disburseB2c` with idempotency key
  `bystay-payout-<id>`.
- Expose `markPaidFromBytebazaar` / `markPayoutFailedFromBytebazaar`
  (service-token-guarded) for Bytebazaar's callback (BB-5) to call.
- **AC:** a payout reflects correct status end-to-end; insufficient float
  refuses cleanly; duplicate keys don't double-pay.

---

## 5. Env var registry (set on both sides before each story)

**Bytebazaar (Convex prod) — for the bridge callbacks to FammyComfort:**
- `BYTEBAZAAR_SERVICE_TOKEN_BYTESTAY` — shared secret (generate once).
- `BYTESTAY_CONVEX_URL` — FammyComfort's Convex URL (for payout callbacks).

**Bytebazaar (plane build / Vercel):**
- `NEXT_PUBLIC_BYTESTAY_URL` — FammyComfort app URL (launcher SSO target).

**FammyComfort (its Convex — `dev:quixotic-boar-465`):**
- `BYTEBAZAAR_SERVICE_TOKEN` — **same value** as `…_BYTESTAY` above.
- `BYTEBAZAAR_CONVEX_URL` — the Bytebazaar platform Convex URL (to call
  `api.sso.*` and `api.bridge.bytestay.*`).

Rotation: set the new secret on FammyComfort first, then Bytebazaar.

---

## 6. Sequencing
1. **Story 2.1 first** (SSO + orgId + identity cache) — nothing works without
   the session it produces.
2. BB-1..BB-3 can land in parallel (makes ByteStay launchable for testing
   2.1 against a real handoff).
3. Then 2.2 → 2.3 → 2.4, with BB-4/BB-5 landing just before 2.3/2.4 need them.
4. Mirror this spec into the FammyComfort repo as its Epic 2 source of truth.
   *(Done — this file.)*

## 7. Resolved decisions
- Onboarding: **self-serve** (`requiresReview: false`). No KYC at purchase.
- Bridge scope: **full** (SMS + collect + B2C payouts).
- First step: **this spec**, then Story 2.1.

---

## 8. FammyComfort build status (this repo)

Tracks what's actually landed vs gated, so the story file and this stay honest.

**Landed (verifiable here — dev deployment `quixotic-boar-465` is reachable):**
- Story 2.1 **foundation slice** — see
  `_bmad-output/implementation-artifacts/2-1-staff-authentication-with-jwt.md`:
  - orgId multi-tenancy convention + `organizations`/`users` identity-cache
    tables (`convex/schema.ts`);
  - `requireOrgUser`/`getOptionalOrgUser` org-scoped identity gate
    (`convex/lib/auth.ts`);
  - `upsertFromHandoff` (idempotent) + `me` + `listOrgStaff` (`convex/identity.ts`);
  - `completeHandoff` handoff-orchestration action, env-guarded (`convex/sso.ts`);
  - `convex-test` coverage incl. tenant isolation — backend suite **9/9 green**,
    `pnpm typecheck` clean.

**Gated on the shared secret + BB-1..BB-3 (cross-repo):**
- The live `/sso` round-trip (`verifyHandoff` → mint session → `consumeHandoff`)
  can't be exercised end-to-end until `BYTEBAZAAR_SERVICE_TOKEN` /
  `BYTEBAZAAR_CONVEX_URL` are set and the ByteStay tile issues a real handoff.
