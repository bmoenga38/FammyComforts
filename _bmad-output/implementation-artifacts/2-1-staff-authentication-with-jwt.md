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
- [ ] **Task 6: `/sso` web route — DEFERRED (gated, see Dev Notes)**
  - [ ] Add `convex` to `apps/web`; a server-side `ConvexHttpClient` helper.
  - [ ] `app/sso/route.ts` (Next 16 route handler — **read
        `node_modules/next/dist/docs/` first** per `apps/web/AGENTS.md`): read
        `?token=`, call `api.sso.completeHandoff`, set the session cookie,
        redirect into the shell.
  - [ ] Configure `@convex-dev/auth` with a **custom credentials provider** that
        trusts the verified handoff, to mint the session for the resolved
        `userId` (the `completeHandoff` step-4 seam).
- [ ] **Task 7: env + cross-repo prerequisites — DEFERRED**
  - [ ] Generate the shared secret; set `BYTEBAZAAR_SERVICE_TOKEN` +
        `BYTEBAZAAR_CONVEX_URL` on FammyComfort (and the `_BYTESTAY` twins on
        Bytebazaar). (spec §5)
  - [ ] Land **BB-1..BB-3** in the Bytebazaar repo so the ByteStay tile issues a
        real handoff to test AC #2/#3 end-to-end. (spec §3)

## Dev Notes

### What landed (verifiable here — dev deployment `quixotic-boar-465` reachable)
- `convex/schema.ts`: orgId convention documented; `organizations` + `users`
  identity-cache tables with their indexes.
- `convex/lib/auth.ts`: `requireOrgUser` / `getOptionalOrgUser` (the org-scoped
  identity seam; subject parsed as `"<userId>|<sessionId>"`-tolerant).
- `convex/identity.ts`: `upsertFromHandoff` (idempotent), `me`, `listOrgStaff`.
- `convex/sso.ts`: `completeHandoff` action (env-guarded orchestration).
- `convex/identity.test.ts`: 5 tests; full backend suite **9/9 green**;
  `pnpm typecheck` clean. `convex codegen` regenerated `_generated` (committed).

### Gated (cannot complete offline / without the cross-repo work)
1. **End-to-end `/sso` round-trip.** Needs `BYTEBAZAAR_CONVEX_URL` +
   `BYTEBAZAAR_SERVICE_TOKEN` set and **BB-1..BB-3** landed so a real handoff is
   issued. `completeHandoff` throws `SSO_NOT_CONFIGURED` until then (by design).
2. **Session minting.** `@convex-dev/auth` with a custom credentials provider
   (trusting the verified handoff) must be installed + configured against the
   deployment (`npx @convex-dev/auth` generates `auth.config.ts` + keys). This is
   the `completeHandoff` step-4 seam — AC #2's "lands an authenticated session"
   is not fully verifiable until it's wired.
3. **Web route.** `apps/web` has no `convex` dep yet, and the Next.js version is
   flagged as unfamiliar (`apps/web/AGENTS.md`) — the route handler must be
   written against the local `node_modules/next/dist/docs/`, not from memory.

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
- Foundation slice landed + verified offline against the live dev deployment:
  schema (orgId + identity cache), `requireOrgUser` gate, SSO cache functions,
  `completeHandoff` orchestration, 9/9 backend tests, clean typecheck.
- `/sso` web route + session minting + cross-repo env/BB-1..BB-3 are the
  remaining gated steps (Tasks 6–7) — documented, not started.

### File List
- Added: `packages/backend/convex/identity.ts`,
  `packages/backend/convex/lib/auth.ts`,
  `packages/backend/convex/sso.ts`,
  `packages/backend/convex/identity.test.ts`,
  `docs/integrations/bytestay-fammycomfort-epic2-spec.md`
- Modified: `packages/backend/convex/schema.ts`,
  `packages/backend/convex/_generated/*` (codegen)
