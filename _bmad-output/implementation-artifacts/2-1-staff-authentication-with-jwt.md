---
baseline_commit: 088c4c7af8d3ecab31f1e523e51c546a4ac3e5ed
---

# Story 2.1: Staff authentication (via ByteAuth SSO + org scoping)

Status: in-progress

> **⚠️ Reframed twice — read this.** The epic title/filename say "JWT". That was
> first reframed to Convex Auth **Password** login (2026-06-08), and is **now
> superseded again** by the locked Epic 2 integration direction
> (`docs/integrations/bytestay-fammycomfort-epic2-spec.md`):
> FammyComfort does **not** own credentials. Staff authenticate through the
> **Bytebazaar (ByteAuth) SSO handoff** — a one-time token verified against the
> Bytebazaar platform Convex — and FammyComfort mints its own session from the
> verified identity. The **one non-negotiable** added by this direction:
> **every tenant table carries `orgId` (`v.id("organizations")`) + a `by_org`
> index, and every query/mutation filters by the SSO-resolved `orgId`** (spec §2).
> The **filename is kept** (`2-1-...-with-jwt.md`) for sprint-status continuity.
> RBAC (roles/permissions tables + `requirePermission`) remains **Story 2.3**;
> this story lands the orgId convention, the SSO identity cache, the handoff
> orchestration, the org-scoped identity gate, and the `me` resolution.

## Story

As a staff member,
I want to open ByteStay from the BytePlane launcher and be signed in
automatically under my organization,
so that I land in an authenticated, org-scoped FammyComfort session without a
separate password — and can only ever see my own organization's data.

## Acceptance Criteria

1. **Multi-tenancy is structural from this story on.** Every tenant-scoped
   Convex table carries `orgId: v.id("organizations")` and a `by_org*` index;
   every tenant-scoped query/mutation resolves `orgId` from the session
   (`requireOrgUser`) and filters by it. `organizations` (the tenant root) and
   non-tenant infra tables (`backupRuns`) are the only exemptions. (spec §2)

2. **A verified SSO handoff establishes an org-scoped session.** Given a valid
   one-time handoff token issued by BytePlane for the `rental` product, when the
   `/sso` route completes, then the token is verified against Bytebazaar
   (`api.sso.verifyHandoff`), the org+user are upserted into the local identity
   cache, the token is consumed (`consumeHandoff`), and the client lands in an
   authenticated FammyComfort session for that user. (spec §4 Story 2.1)

3. **Expired / used / forged tokens are rejected.** Given an invalid token
   (expired, already consumed, tampered, or for an org that doesn't own/active
   the product), when `/sso` runs, then no session is created and no identity is
   cached — `verifyHandoff` returning null surfaces a clean error.

4. **Identity is resolvable server-side, org-scoped.** Given an authenticated
   session, `requireOrgUser(ctx)` resolves to the signed-in `users` doc + their
   `orgId`; an unauthenticated/inactive caller resolves to `null`
   (`getOptionalOrgUser`) or throws `UNAUTHENTICATED` (`requireOrgUser`). A `me`
   query returns the safe profile (`_id`, `name`, `email`, `phone`, `role`,
   `isActive`, `org{_id,name,slug}`) and never leaks the Bytebazaar ids.

5. **Inactive accounts cannot hold a session.** Given a `users` row with
   `isActive: false`, when their identity is resolved, then `me` returns `null`
   and `requireOrgUser` throws — the server-authoritative gate Story 2.4
   (deactivate) and Story 2.3 (RBAC) build on.

6. **Tenant isolation holds.** Given sessions for org A and org B, when org A's
   session reads an org-scoped query (`listOrgStaff`), then it returns only org
   A's rows — org B's data is never visible. Proven by `convex-test`.

7. **The upsert is idempotent.** Re-running the handoff for the same Bytebazaar
   org/user refreshes the cached fields in place (no duplicate rows), keyed on
   `bytebazaarOrgId` / `bytebazaarUserId`.

8. **Build & tests stay green.** `pnpm typecheck` + `pnpm test` pass for
   `packages/backend`, including `convex-test` coverage for the upsert,
   idempotency, `me` (authed + unauthed + inactive), tenant isolation, and the
   unauthenticated rejection.

## Tasks / Subtasks

- [x] **Task 1: orgId schema convention + identity-cache tables (AC #1, #4, #5)**
  - [x] Document the multi-tenancy non-negotiable in `convex/schema.ts`'s
        conventions block (orgId + `by_org` on every tenant table; exemptions).
  - [x] Add `organizations` (`bytebazaarOrgId`, `name`, `slug`;
        `by_bytebazaar_org`) — the tenant root.
  - [x] Add `users` (`orgId`, `bytebazaarUserId`, `name`, `phone?`, `email?`,
        `role`, `isActive`; `by_org`, `by_bytebazaar_user`).
- [x] **Task 2: Org-scoped identity gate (AC #4, #5)**
  - [x] `convex/lib/auth.ts`: `getOptionalOrgUser` / `requireOrgUser` resolving
        `getUserIdentity().subject` → `users` doc → `{ user, orgId }`, gating
        inactive accounts. The seam Story 2.3's `requirePermission` extends.
- [x] **Task 3: SSO identity cache functions (AC #2, #4, #6, #7)**
  - [x] `convex/identity.ts`: `upsertFromHandoff` (internalMutation, idempotent),
        `me` (safe profile), `listOrgStaff` (org-scoped — the isolation proof).
- [x] **Task 4: Handoff orchestration action (AC #2, #3)**
  - [x] `convex/sso.ts`: `completeHandoff` action — verify against Bytebazaar →
        `upsertFromHandoff` → consume. Env-guarded on `BYTEBAZAAR_CONVEX_URL`.
- [x] **Task 5: Tests (AC #6, #7, #8)**
  - [x] `convex/identity.test.ts`: upsert+idempotency, `me` authed/unauthed,
        inactive gate, tenant isolation, unauthenticated rejection. **9/9 green**
        (5 new + 4 existing) with `convex codegen` run against `quixotic-boar-465`.
- [x] **Task 6: Session minting + `/sso` web route (AC #2)**
  - [x] `convex/auth.ts`: `convexAuth({ providers: [ConvexCredentials({ id:
        "sso-handoff", authorize })] })` — `authorize` calls the shared
        `resolveHandoff` (verify→upsert→consume) and returns the `userId` Convex
        Auth mints a session for. `convex/http.ts` mounts the auth routes;
        `convex/auth.config.ts` declares the JWT issuer.
  - [x] `...authTables` merged into `convex/schema.ts` (our `users` override
        keeps the app/tenancy fields). Codegen + typecheck + 9/9 tests green.
  - [x] Auth keys provisioned on `quixotic-boar-465` (`SITE_URL`,
        `JWT_PRIVATE_KEY`, `JWKS` via `scripts/gen-auth-keys.mjs`).
  - [x] Web: `convex` + `@convex-dev/auth` added; `ConvexClientProvider`
        (`ConvexAuthProvider` + a single `ConvexReactClient`) nested in the root
        layout; `app/sso/page.tsx` (client) reads `?token=`, calls
        `signIn("sso-handoff", { token })`, redirects. `NEXT_PUBLIC_CONVEX_URL`
        env added. Web lint+typecheck+tests (37) green; **production build OK**
        (`/sso` prerenders). *(Client-side auth only — SSR/proxy route-guarding
        is Story 2.3; Next 16 renames middleware→proxy.)*
- [ ] **Task 7: env + cross-repo prerequisites — DEFERRED (the only remaining gate)**
  - [ ] Generate the shared secret; set `BYTEBAZAAR_SERVICE_TOKEN` +
        `BYTEBAZAAR_CONVEX_URL` on FammyComfort (and the `_BYTESTAY` twins on
        Bytebazaar). (spec §5)
  - [ ] Land **BB-1..BB-3** in the Bytebazaar repo so the ByteStay tile issues a
        real handoff to test AC #2/#3 end-to-end. (spec §3)

## Dev Notes

### What landed (verifiable here — dev deployment `quixotic-boar-465` reachable)
- `convex/schema.ts`: orgId convention + `organizations`/`users` identity-cache
  tables; `...authTables` merged (our `users` override keeps the app fields).
- `convex/lib/auth.ts`: `requireOrgUser` / `getOptionalOrgUser` (the org-scoped
  identity seam; subject parsed as `"<userId>|<sessionId>"`-tolerant).
- `convex/identity.ts`: `upsertFromHandoff` (idempotent), `me`, `listOrgStaff`.
- `convex/sso.ts`: `resolveHandoff` (shared verify→upsert→consume) + the
  `completeHandoff` action wrapper (env-guarded).
- `convex/auth.ts` + `http.ts` + `auth.config.ts`: Convex Auth with the
  `sso-handoff` credentials provider (mints the session from a verified handoff).
- Auth keys provisioned on the deployment (`SITE_URL`/`JWT_PRIVATE_KEY`/`JWKS`
  via `scripts/gen-auth-keys.mjs`).
- Web: `ConvexClientProvider` in the root layout + `app/sso/page.tsx`; backend
  9/9 + web 37/37 tests green, full turbo gate green, **web production build OK**.

### Gated — the ONLY remaining step (cross-repo, see Task 7)
**End-to-end `/sso` round-trip.** Everything FammyComfort-side is wired and
verified; the live sign-in just needs `BYTEBAZAAR_CONVEX_URL` +
`BYTEBAZAAR_SERVICE_TOKEN` set on this deployment and **BB-1..BB-3** landed in
the Bytebazaar repo so the ByteStay tile issues a real handoff. Until then,
`resolveHandoff` throws `SSO_NOT_CONFIGURED` by design — so AC #2/#3's live
"tile → authenticated session" can't be exercised here, though every piece it
depends on is built, typechecked, and unit-tested.

### Design notes
- **`organizations` is the tenant root** — it carries its own `bytebazaarOrgId`,
  not an `orgId` FK. Every *other* tenant table gets `orgId`.
- **`role` is the raw SSO role string** — Story 2.3 refines it into the
  roles/permissions model; `requireOrgUser` is intentionally the lower seam that
  `requirePermission` will wrap.
- **`auditLogs.actorId` stays `v.optional(v.string())`** for now (Story-1
  scaffold) — migrate to `v.id("users")` + add `orgId` when the audit-on-auth
  events land (Story 2.5 / when session minting is wired), to avoid touching the
  passing 1.10 backup/audit tests in this slice.
- **Identity resolution** reads `getUserIdentity().subject`; `convex-test`'s
  `withIdentity({ subject: userId })` matches the real `@convex-dev/auth` subject
  once minting is wired (we split on `|` to tolerate both forms).

### References
- [Source: docs/integrations/bytestay-fammycomfort-epic2-spec.md] — locked Epic 2
  direction; §2 (orgId non-negotiable), §3 (BB-1..BB-5), §4 (Story 2.1), §5 (env).
- [Source: _bmad-output/planning-artifacts/data-model.md#R1-—-Identity-&-Access] —
  User field shapes (re-expressed here as the SSO cache; no `passwordHash`).
- [Source: packages/backend/convex/{schema,identity,sso,lib/auth}.ts] — the
  landed implementation.
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend-Platform-Addendum]
  — Convex conventions (AR4′/AR6′/AR9).

## Dev Agent Record

### Agent Model Used
claude-opus-4-8[1m]

### Completion Notes List
- Foundation slice + session minting (A1+A2) landed and verified against the live
  dev deployment `quixotic-boar-465`: schema (orgId + identity cache + authTables),
  `requireOrgUser` gate, SSO cache functions, `resolveHandoff`/`completeHandoff`,
  Convex Auth `sso-handoff` provider, auth keys provisioned, web client provider +
  `/sso` page. Backend 9/9 + web 37/37 tests, full turbo gate green, web prod build OK.
- **Only Task 7 remains** (cross-repo): set `BYTEBAZAAR_CONVEX_URL` +
  `BYTEBAZAAR_SERVICE_TOKEN`, land BB-1..BB-3 → then the live tile→session round-trip
  can be exercised. `auditLogs` orgId/actorId migration deferred to Story 2.5.

### File List
- Added (backend): `convex/identity.ts`, `convex/lib/auth.ts`, `convex/sso.ts`,
  `convex/auth.ts`, `convex/http.ts`, `convex/auth.config.ts`,
  `convex/identity.test.ts`, `scripts/gen-auth-keys.mjs`
- Added (web): `src/components/convex-client-provider.tsx`,
  `src/app/sso/page.tsx`, `.env.example`
- Added (docs): `docs/integrations/bytestay-fammycomfort-epic2-spec.md`
- Modified (backend): `convex/schema.ts` (+authTables/identity), `package.json`,
  `convex/_generated/*` (codegen)
- Modified (web): `src/app/layout.tsx` (nest `ConvexClientProvider`), `package.json`
- Env (deployment): `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS` set on `quixotic-boar-465`
