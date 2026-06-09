---
baseline_commit: 088c4c7af8d3ecab31f1e523e51c546a4ac3e5ed
---

# Story 2.1: Staff authentication with JWT

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **⚠️ Backend reframed → Convex Auth (2026-06-08).** The epic title and this filename say "JWT", but per the **architecture.md Backend Platform Addendum (AR6′)** the JWT-access + rotating-refresh + argon2id design is **superseded by Convex Auth** (`@convex-dev/auth`, Password provider). Convex Auth manages password hashing, session issuance, and token refresh internally (it *uses* JWTs under the hood, but the app never mints, rotates, or denylists them). The ACs below are **reframed for Convex**: "short-lived access + rotating refresh + argon2id + manual denylist" become "Convex Auth `signIn`/`signOut` + a server-authoritative `users` row + `isActive` gate". The **filename is kept** (`2-1-staff-authentication-with-jwt.md`) for sprint-status continuity. The permission **model** is untouched — RBAC enforcement (roles/permissions tables + `requirePermission`) is **Story 2.3**; this story lands only the `users`/auth tables, sign-in/sign-out, identity resolution, and the active-account gate.

## Story

As a staff member,
I want to log in with my email and password and stay signed in securely,
so that I can access the tools my role permits.

## Acceptance Criteria

1. **Password login issues a Convex Auth session (replaces "short-lived access + rotating refresh").**
   **Given** a staff member with valid email + password credentials
   **When** they submit the login form
   **Then** Convex Auth's Password provider verifies the password against its internally-hashed credential (Convex Auth owns hashing — argon2id/scrypt internally; the app never stores a `passwordHash` column itself), establishes an authenticated session, and the client transitions to a signed-in state. (FR55, NFR6, AR6′)

2. **Identity is resolvable server-side from `ctx.auth`.**
   **Given** an authenticated session
   **When** any Convex function calls `getAuthUserId(ctx)` (or `ctx.auth.getUserIdentity()`)
   **Then** it resolves to the signed-in user's `Id<"users">`, and an unauthenticated caller resolves to `null` — a `me`/`currentUser` query returns the signed-in user's safe profile (`_id`, `email`, `fullName`, `phone`, `isActive`) for authed callers and `null` otherwise. (NFR6)

3. **Token refresh is automatic (replaces the manual access/refresh-rotation AC).**
   **Given** a long-lived signed-in session
   **When** the underlying access token expires
   **Then** the Convex client + Convex Auth refresh the session transparently with no app-level refresh-token table, rotation logic, or denylist — the user stays signed in until they sign out or the session is revoked. (NFR6, AR6′)

4. **Sign-out ends the session (replaces "logout denylists the refresh token").**
   **Given** a signed-in staff member
   **When** they sign out
   **Then** Convex Auth `signOut` revokes the session server-side and the client returns to the unauthenticated state; subsequent `getAuthUserId(ctx)` calls for that session resolve to `null`. (FR55)

5. **Inactive / soft-deleted accounts cannot hold a session.**
   **Given** a `users` row with `isActive: false` (or `deletedAt` set)
   **When** that user signs in or an authed function resolves their identity
   **Then** access is denied (`me` returns `null` / functions throw `UNAUTHENTICATED`) — `isActive` is the server-authoritative gate that Story 2.4 (deactivate staff) and Story 2.3 (RBAC) build on. The check is enforced server-side, never trusted from the client. (NFR6; sets up FR14 / Story 2.4)

6. **Invalid credentials and validation are handled cleanly.**
   **Given** a wrong password, unknown email, or malformed input
   **When** login is attempted
   **Then** sign-in fails with a generic "invalid credentials" message (no user-enumeration leak — same response for unknown-email vs wrong-password), no session is created, and the login form surfaces the error without crashing.

7. **Sensitive auth events are audited (ties Story 2.5 / AR9).**
   **Given** a successful sign-in, a sign-out, or a failed sign-in attempt
   **When** it occurs
   **Then** an `auditLogs` row is written via the existing `auditLogs.record` path (`action` = `auth.login` / `auth.logout` / `auth.login_failed`, `entityType` = `user`, `actorId` = the resolved user id where known) within the same transaction as the state change. (FR17, NFR8, AR9)

8. **Build & tests stay green.**
   **Given** the changes
   **When** `pnpm typecheck` / `pnpm lint` / `pnpm test` run across the workspace
   **Then** all gates pass, including `convex-test` coverage for: a successful login + `me` round-trip, an inactive-account denial, an invalid-credentials failure, and the audit-on-login write. *(See the offline-scope caveat in Dev Notes — the `convex/_generated` + live-deploy steps require a Convex login and are deferred; everything else is buildable offline.)*

## Tasks / Subtasks

- [ ] **Task 1: Install Convex Auth + provision auth env (AC: #1, #3)** *(partially deferred — needs Convex login)*
  - [ ] `pnpm --filter @fammycomforts/backend add @convex-dev/auth @auth/core` (pin `@auth/core` to the version the `@convex-dev/auth` README specifies). **[DEFERRED-online: the install is offline-OK, but `npx @convex-dev/auth` to generate `SITE_URL` + `JWKS`/`JWT_PRIVATE_KEY` and `convex/auth.config.ts` requires a Convex login — see Dev Notes.]**
  - [ ] After install, **verify the installed API** against `node_modules/.pnpm/@convex-dev+auth@*/.../server` — confirm `convexAuth`, `getAuthUserId`, `authTables` signatures (they evolved across 0.0.x) before relying on the guide's snippets.
- [ ] **Task 2: Schema — add `users` + auth tables to `convex/schema.ts` (AC: #1, #2, #5)**
  - [ ] Spread `...authTables` from `@convex-dev/auth/server` into `defineSchema` (provides `users`, `authSessions`, `authAccounts`, …).
  - [ ] Extend the auth `users` table with the app fields from data-model.md R1 `User`: `fullName: v.string()`, `phone: v.optional(v.string())`, `isActive: v.boolean()` (default `true` on insert), `deletedAt: v.optional(v.number())`. Keep `email` (provided by auth tables) and add an `.index("by_email", ["email"])` if not already present for lookups. **Do NOT add a `passwordHash` field** — Convex Auth owns credentials (drop the Prisma `passwordHash` column; drop `RefreshToken` entirely per AR6′).
  - [ ] Migrate `auditLogs.actorId` from `v.optional(v.string())` → `v.optional(v.id("users"))` now that `users` exists (update the existing `auditLogs.ts` `record` mutation arg + `by_actor` index accordingly). Verify `health.check` and the existing `auditLogs` tests still pass against the new schema.
  - [ ] Leave `roles`/`permissions`/`rolePermissions`/`userRoles` for **Story 2.3** — do not add them here (per-story-tables principle, AR4′).
- [ ] **Task 3: `convex/auth.ts` — Convex Auth wiring (AC: #1, #3, #4)**
  - [ ] `export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({ providers: [Password] })`.
  - [ ] Confirm `convex/auth.config.ts` registration (generated by the auth CLI) and that `ctx.auth` resolves the provider as a JWT issuer.
- [ ] **Task 4: `convex/lib/auth.ts` — identity helper + active-account gate (AC: #2, #5)**
  - [ ] `requireAuthUser(ctx)`: `getAuthUserId(ctx)` → throw `UNAUTHENTICATED` if `null`; `ctx.db.get(userId)` → throw `UNAUTHENTICATED` if `isActive === false` or `deletedAt` set; return the user doc. This is the seam Story 2.3's `requirePermission` will build on top of.
  - [ ] `getOptionalAuthUser(ctx)`: same but returns `null` instead of throwing (for `me`-style queries).
- [ ] **Task 5: `convex/users.ts` — `me` query + audited sign-in/out hooks (AC: #2, #5, #6, #7)**
  - [ ] `me` query: returns the safe profile (`_id`, `email`, `fullName`, `phone`, `isActive`) via `getOptionalAuthUser`, or `null`. **Never** return credential/auth-internal fields.
  - [ ] Audit hook: a `internalMutation` (or call into `auditLogs.record`) invoked on login success/failure and logout — `action` ∈ `auth.login | auth.logout | auth.login_failed`, `entityType: "user"`, `actorId` from `ctx.auth` where resolvable. Wire it through the Convex Auth callbacks/`afterUserCreatedOrUpdated`/`session` lifecycle if the installed version exposes one; otherwise write the audit row from a thin wrapper mutation the client calls immediately after `signIn`/`signOut` resolves. **Verify the available callback surface against the installed package** (Dev Notes).
- [ ] **Task 6: Web — Convex client provider + login UI (AC: #1, #2, #4, #6)**
  - [ ] **Bootstrap the Convex React client** (first story to need it): add a `ConvexAuthProvider` (from `@convex-dev/auth/react`) wrapping the app, fed by a single long-lived `ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)`. Place it inside the existing root-layout provider stack (`QueryProvider > ToastProvider > OfflineBanner`) — do **not** recreate the client per render. Add `NEXT_PUBLIC_CONVEX_URL` to `apps/web` env (`.env.local` / example).
  - [ ] Login screen: a `/login` route (or modal) with email + password fields built from the existing UI primitives (`Input`, `Button`, `Card` from `@/components/ui`, Stories 1.3/1.4), React-Hook-Form + a Zod schema mirroring the server contract (UX only — server stays authoritative). Calls `useAuthActions().signIn("password", { email, password, flow: "signIn" })`.
  - [ ] Surface a generic error on failure (AC #6); on success route into the app shell (`/guest` default per Story 1.7). Add a sign-out control (wire `signOut()` into the shell sidebar/top-bar — extend Story 1.7's shell, do not rebuild it).
  - [ ] **Do not** add route-group auth guarding / permission-gated nav here — the `(staff)` guard split + RBAC are Story 2.3 (keep this consistent with Story 1.7's deferred note).
- [ ] **Task 7: Tests (AC: #8)** *(deferred until `_generated` exists — needs one Convex codegen)*
  - [ ] Set up the `packages/backend` `convex-test` harness per the guide: add `-D convex-test vitest @edge-runtime/vm`, a scoped `packages/backend/vitest.config.ts` (`environment: "edge-runtime"`, `server.deps.inline: ["convex-test"]`, `include: ["convex/**/*.test.ts"]`), and a `"test": "vitest run"` script so `turbo run test` picks it up. **Do not** touch other packages' (node-env) Vitest configs.
  - [ ] `convex/users.test.ts`: using `t.withIdentity(...)` — (a) authed `me` returns the profile; (b) unauthed `me` returns `null`; (c) an `isActive: false` user is denied by `requireAuthUser`; (d) the audit-on-login row is written. Stub/skip the password-verification internals (owned by Convex Auth) — assert the app-level contract (`me`, `isActive` gate, audit), not Convex Auth's hashing.
  - [ ] Web: a small RTL test that the login form renders, validates required fields, and shows the generic error on a failed `signIn` (mock `useAuthActions`).

## Dev Notes

### Convex specifics (authoritative — Convex Implementation Guide §Auth & RBAC)

- **Tables touched:** `convex/schema.ts` gains `...authTables` (Convex-Auth-managed `users`/`authSessions`/`authAccounts`) + app fields on `users` (`fullName`, `phone`, `isActive`, `deletedAt`). `auditLogs.actorId` is migrated `string → v.id("users")`. **No `roles`/`permissions` tables yet** (Story 2.3). **No `passwordHash`/`RefreshToken`** (AR6′ — Convex Auth owns both).
- **Functions:** `convex/auth.ts` (`convexAuth({ providers: [Password] })` → `auth`/`signIn`/`signOut`/`store`/`isAuthenticated`); `convex/lib/auth.ts` (`requireAuthUser` / `getOptionalAuthUser` — the active-account gate, the seam Story 2.3's `requirePermission` extends); `convex/users.ts` (`me` query + audit hooks). Public client-facing functions are `query`/`mutation`; audit writers should be `internalMutation` where not directly client-invoked.
- **Identity:** prefer `getAuthUserId(ctx)` (`@convex-dev/auth/server`) → typed `Id<"users"> | null` over the lower-level `ctx.auth.getUserIdentity()` (OIDC claims). In queries/mutations an unauthenticated caller yields `null` (does **not** throw); in HTTP actions `getUserIdentity()` *throws* — not relevant to this story (no webhook here).
- **`v.*` validators are the server contract** — every function declares `args` with `convex/values` validators; `me`'s returned shape is explicit and excludes any auth-internal/credential field. The web Zod login schema mirrors the args for UX only and is never trusted.
- **Audit from mutations (AR9):** auth events write `auditLogs` rows; `actorId` derives from `ctx.auth`, not client args. Reuse the existing `auditLogs.record` contract (Story-1 scaffold) — this story only changes `actorId`'s type to `v.id("users")`.
- **RBAC is explicitly out of scope** here. This story stops at *authentication* + the `isActive` gate; *authorization* (the 12-role × 18-area × `read|write|manage` model, `rolePermissions`/`userRoles`, `requirePermission`) is **Story 2.3**. Build `requireAuthUser` so 2.3 layers permission checks on top without rework.

### ⚠️ Right-scope: buildable-offline vs deferred (honest, per prior stories)

The dev environment has **no Convex login**, so anything requiring a live deployment or codegen cannot complete here. Mirrors the deferral pattern from Story 1.8's Convex work.

- **Buildable offline (do now):** install `@convex-dev/auth`/`@auth/core` (+ `convex-test` dev deps); write `convex/schema.ts` additions, `convex/auth.ts`, `convex/lib/auth.ts`, `convex/users.ts`, and the `auditLogs.actorId` migration; write the web `ConvexAuthProvider` bootstrap + login UI + sign-out wiring; author all test files; author the `packages/backend/vitest.config.ts`.
- **Deferred — requires a Convex login (`npx convex dev` / `convex codegen` / `convex deploy` against `quixotic-boar-465`):**
  1. `convex/_generated/{api,server,dataModel}` does not exist until the first `convex dev`/`codegen` — so `convex/**` imports (`./_generated/server`, `api`, `internal`) and TS typecheck of backend functions **will not resolve**, and `convex-test` (which loads the real `schema` + functions) **cannot run** until then. Tests are authored now, gated/excluded from CI until codegen runs.
  2. `npx @convex-dev/auth` to generate `convex/auth.config.ts` + the `SITE_URL` / `JWKS` / `JWT_PRIVATE_KEY` env keys, and `NEXT_PUBLIC_CONVEX_URL` for the web client, need the live deployment.
  3. Verifying the **installed** `convexAuth`/`getAuthUserId`/`authTables` signatures and the auth-callback surface (for the audit hook) requires the package present + (ideally) a dev deploy to smoke-test the login round-trip.
  4. End-to-end "log in → `me` resolves → sign out" can only be confirmed against a running deployment. Call these out in the Dev Agent Record; do not mark AC #1/#3/#4 fully verified offline.

### Build on existing work — do not regress
- **Reuse Story 1.7's shell** for the signed-in surface and the sign-out control; reuse `@/components/ui` primitives (1.3/1.4) for the login form. Keep the root-layout provider stack (`QueryProvider > ToastProvider > OfflineBanner`) intact and nest the Convex provider within it.
- **Reuse the `auditLogs` scaffold** (`record`/`listForEntity`, `by_entity`/`by_actor` indexes) — only the `actorId` type changes.
- TanStack Query stays for non-Convex fetches only; auth state comes from Convex Auth's React hooks, not TanStack.

### Testing standards
- Backend: `convex-test` under `edge-runtime` (scoped to `packages/backend`), `t.withIdentity({ subject })` to fake auth, real `schema.ts` enforced. Web: Vitest + RTL + jsdom, mock `@convex-dev/auth/react` `useAuthActions`. Colocated `*.test.ts(x)`. Both gated behind `convex codegen` for backend per the offline caveat.

### Project Structure Notes
- **New (backend):** `packages/backend/convex/auth.ts`, `convex/auth.config.ts` (CLI-generated), `convex/lib/auth.ts`, `convex/users.ts`, `convex/users.test.ts`, `packages/backend/vitest.config.ts`.
- **Modified (backend):** `convex/schema.ts` (+`authTables`, +`users` app fields, `auditLogs.actorId` → `v.id("users")`), `convex/auditLogs.ts` (`actorId` arg type + audit-event wiring), `packages/backend/package.json` (deps + `test` script).
- **New (web):** a Convex provider component (e.g. `apps/web/src/components/convex-provider.tsx`), a `/login` route + login form component, `apps/web/.env.local` example with `NEXT_PUBLIC_CONVEX_URL`.
- **Modified (web):** root `layout.tsx` (nest `ConvexAuthProvider`), the Story-1.7 shell (sign-out control). Root provider order and the offline/PWA work must not regress.
- **Variance:** epic/filename say "JWT + rotating refresh + argon2id + denylist"; implemented as Convex Auth per AR6′ (documented in the banner). `(guest)`/`(staff)` route-guarding + RBAC intentionally deferred to Story 2.3, consistent with Story 1.7's deferred split. No changes to `apps/api` (superseded stack).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1] — user story + the two original (JWT-framed) ACs; Epic 2 scope (FR14, FR17, FR55; NFR6, NFR8).
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend-Platform-Addendum] — AR6′ (Convex Auth replaces JWT/refresh/argon2id; RBAC moves in-function), AR9 (audit unchanged); web wiring note (single `ConvexReactClient` from `NEXT_PUBLIC_CONVEX_URL`).
- [Source: _bmad-output/planning-artifacts/data-model.md#R1-—-Identity-&-Access] — `User`/`Role`/`Permission`/`RolePermission`/`UserRole`/`RefreshToken`/`AuditLog` field shapes + the Convex mapping banner (drop `RefreshToken`; `actorId` → `v.id("users")`).
- [Source: Convex Implementation Guide §Auth & RBAC] — `convexAuth({ providers: [Password] })`, `getAuthUserId`, `authTables`, `requirePermission` precedent (the helper this story's `requireAuthUser` precedes); gotchas (verify installed signatures, `@auth/core` peer, env keys, `getUserIdentity` null-vs-throw).
- [Source: Convex Implementation Guide §Testing (convex-test)] — scoped `edge-runtime` vitest config, `t.withIdentity`, `_generated` must exist first.
- [Source: packages/backend/convex/{schema.ts,auditLogs.ts,health.ts}] — the scaffold to extend (`auditLogs` table/indexes, the `actorId` TODO, conventions comment).
- [Source: _bmad-output/implementation-artifacts/1-7-role-workspace-navigation-shell.md] — the app shell to extend (sign-out control) and the deferred `(guest)`/`(staff)` guard split this story continues to defer to 2.3.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
