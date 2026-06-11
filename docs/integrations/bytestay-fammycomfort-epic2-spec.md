# ByteStay (FammyComfort) ⇄ Bytebazaar — Integration Spec (two-layer model)

> **Mirror provenance.** FammyComfort-repo copy of the locked integration
> direction (authoring copy in the Bytebazaar repo). This is FammyComfort's
> integration source of truth; keep the env-var names (§4) in sync across both
> repos.

Status: **Locked** (Bytebazaar PR #5). SSO is wired + smoke-tested live.

> Naming: internal product **slug = `rental`**, brand/display = **ByteStay**,
> standalone app/repo = **FammyComfort**.

---

## 1. The two-layer model (the one thing not to blur)

FammyComfort **inherits the platform layer** from Bytebazaar and **owns the
product layer** itself. There is **no service bridge and no shared secret.**

| Platform layer — from Bytebazaar (shared) | Product layer — FammyComfort owns |
|---|---|
| **Auth** — ByteAuth SSO (log in once, SSO into ByteStay) | builds no login of its own |
| **Discovery** — catalog / buy ByteStay on Bytebazaar | — |
| **Tenancy** — org identity (`orgId`), provisioning | — |
| **Subscription billing** — the customer pays Bytebazaar for ByteStay | — |
| platform SMS only (welcome/login, Bytebazaar SenderID) | **own SenderID** for operational SMS (e.g. booking confirmations) |
| subscription charges via Bytebazaar's M-Pesa | **own M-Pesa (Daraja) / bank** for in-app money (guest pays for a room) |

One-liner: **inherit auth + discovery + tenancy + subscription billing; own
operational SMS + payments.**

**Explicitly dropped** (earlier "full bridge" was wrong for this architecture):
no `convex/bridge/bytestay.ts`, no `notifySend`/`checkFloat`/`disburseB2c`, no
`markPaidFromBytebazaar` / `markPayoutFailedFromBytebazaar`, no
`bystay-payout-<id>` routing, no `BYTEBAZAAR_SERVICE_TOKEN`. FammyComfort never
built any of these — only this spec previously described them.

---

## 2. The only integration surface: SSO (Story 2.1)

The single FammyComfort↔Bytebazaar runtime dependency. `api.sso.verifyHandoff` /
`api.sso.consumeHandoff` are **public** on the Bytebazaar deployment — the
**single-use handoff token is itself the bearer secret** (no service token).

Flow:
1. User clicks the ByteStay tile in BytePlane → BytePlane mints a one-time
   handoff (`issueHandoff`) and redirects to `…/sso?token=<token>` on the
   FammyComfort app (`NEXT_PUBLIC_BYTESTAY_URL`, set Bytebazaar-side).
2. FammyComfort `/sso` page → `signIn("sso-handoff", { token })`.
3. Backend `resolveHandoff` calls Bytebazaar `api.sso.verifyHandoff(token)` over
   `BYTEBAZAAR_CONVEX_URL` → `{ valid, orgId, userId, org, user }`.
4. Upsert org+user into the local identity cache (`identity.upsertFromHandoff`),
   bootstrap RBAC (`rbac.bootstrapForUser` — seed roles + map the SSO role),
   `consumeHandoff(token)`, mint the FammyComfort session (Convex Auth).
5. Redirect into the app.

**AC:** clicking the tile lands an authenticated, org-scoped FammyComfort
session; expired/used/forged tokens are rejected (`verifyHandoff: valid:false`);
a second tenant cannot see the first's data.

---

## 3. Everything else is FammyComfort's own epics (no Bytebazaar runtime dep)

- **Operational SMS** (booking/check-in/reminder) → FammyComfort's own provider
  + SenderID. *Not* via Bytebazaar.
- **Guest payments / M-Pesa** → FammyComfort's own **Daraja** integration —
  already specced in `_bmad-output/planning-artifacts/mpesa-daraja-integration-spec.md`
  (**Epic 5**, Stories 5.3–5.5). Invoicing / ledger / reconciliation are Epic 5.
- These have **zero** of the dropped bridge contracts. Provider creds live
  entirely in FammyComfort's own env.

---

## 4. Env registry (SSO only)

Two variables, per environment. **`BYTEBAZAAR_CONVEX_URL` points at
*Bytebazaar's* deployment** (so we can call its `api.sso.verifyHandoff`), never
at FammyComfort's own.

| Env value | FammyComfort **DEV** (`quixotic-boar-465`) | FammyComfort **PROD** (`notable-cod-441`) |
|---|---|---|
| `BYTEBAZAAR_CONVEX_URL` (Convex) | `https://amiable-crow-468.convex.cloud` | `https://wandering-corgi-957.convex.cloud` |
| `NEXT_PUBLIC_BYTEPLANE_URL` (web) | `http://localhost:3000` | `https://bytebazaar-plane.vercel.app` |

- `BYTEBAZAAR_CONVEX_URL` → set via `npx convex env set …` from `packages/backend`.
- `NEXT_PUBLIC_BYTEPLANE_URL` → web env (`apps/web/.env.local` / Vercel); the
  `/signin` redirect target.

**⚠️ Critical pairing rule:** a handoff is minted **and** verified in the *same*
Bytebazaar deployment (stored in its `handoffs` table). **Pair dev↔dev and
prod↔prod, never cross** — a local tile mints in Bytebazaar dev
(`amiable-crow-468`), and only `amiable-crow-468` can verify it. Crossing returns
`verifyHandoff: not_found`.

No other Bytebazaar env values are needed.

---

## 5. Build status (this repo)

**SSO (Story 2.1) — done + smoke-tested live (DEV):**
- `BYTEBAZAAR_CONVEX_URL` set on `quixotic-boar-465` → Bytebazaar dev
  (`amiable-crow-468`); `NEXT_PUBLIC_BYTEPLANE_URL=http://localhost:3000` in web.
- Cross-deployment smoke test: `convex run sso:completeHandoff '{"token":"bogus"}'`
  → `SSO_INVALID (reason: not_found)` — proves the call reaches Bytebazaar dev,
  `verifyHandoff` is public, and the `{ valid }` contract matches. A real tile
  token would return `valid:true` → session.
- Backend `sso`/`identity`/`auth`/`rbac` etc. **deployed** to `quixotic-boar-465`.
- Remaining for a full browser round-trip: run BytePlane (dev, :3000) + the
  FammyComfort web app (a non-3000 port) with Bytebazaar's
  `NEXT_PUBLIC_BYTESTAY_URL` pointing at it, then click the tile.

**Identity/Access/Staff/Audit (FammyComfort Epic 2 proper):** done — see the
2.1–2.5 story files. (Distinct from the platform integration above.)

**PROD:** set the PROD env row (§4) + `convex deploy` to `notable-cod-441` when
promoting.
