---
baseline_commit: 088c4c7af8d3ecab31f1e523e51c546a4ac3e5ed
---

# Story 2.2: Password reset

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> **⚠️ Backend reframed → Convex Auth password reset (2026-06-08).** The epic ACs describe a self-minted "time-limited reset token" + "argon2id-hashed password" + manual "invalidate existing sessions" — that hand-rolled token table and hashing is **superseded by Convex Auth** per the **architecture.md Backend Platform Addendum (AR6′)**. Convex Auth's **Password provider supports a built-in reset flow** (`flow: "reset"` → email a one-time code/token; `flow: "reset-verification"` → verify the code + set the new password), where the **verification code IS the time-limited reset token** and Convex Auth owns code generation, expiry, single-use, and password (re-)hashing. So the ACs below are **reframed for Convex**: "issue a reset token" → "Password provider `reset` flow emails a one-time code via a `reset`-capable email provider"; "set a new argon2id-hashed password" → "`reset-verification` flow sets the new Convex-Auth-hashed credential"; "invalidate existing sessions" → "invalidate the user's other Convex Auth sessions on successful reset". The permission **model** and the `auditLogs` contract are unchanged. This builds **directly on Story 2.1** (`convex/auth.ts`, the `users`/`authTables` schema, `convex/lib/auth.ts`, the web `ConvexAuthProvider`, the `auditLogs` actor migration) — it must not rebuild any of that.

## Story

As a staff member,
I want to reset a forgotten password using a one-time code emailed to me,
so that I can regain access to my account without an admin.

## Acceptance Criteria

1. **Requesting a reset emails a one-time, time-limited code (replaces "issue a time-limited reset token").**
   **Given** a registered, active staff email address
   **When** the user submits the "forgot password" form with that email
   **Then** Convex Auth's Password provider `reset` flow generates a one-time verification code and sends it to that email via the configured email provider; the code is single-use and time-limited (expiry owned by Convex Auth's `reset` provider config). The app never stores or hashes the code itself. (FR55, FR17, AR6′)

2. **Reset requests do not leak whether an email is registered (no user-enumeration).**
   **Given** an email that is unknown, inactive (`isActive: false`), or soft-deleted (`deletedAt` set)
   **When** a reset is requested
   **Then** the UI returns the **same** generic "if that email exists, a code has been sent" response as the success path — no different timing/message/error reveals account existence or status, and no code is sent to an unregistered/inactive address. (NFR6)

3. **Verifying the code sets a new Convex-Auth-hashed password (replaces "set a new argon2id-hashed password").**
   **Given** a valid, unexpired, unused reset code for an account
   **When** the user submits the code together with a new password that meets the password policy
   **Then** Convex Auth's `reset-verification` flow verifies the code and updates the account's credential to the new password (Convex Auth owns hashing — argon2id/scrypt internally; the app stores no `passwordHash`), the code is consumed (cannot be reused), and the user is signed in (or routed to login) per the provider's behavior. (FR55, NFR6, AR6′)

4. **A wrong, expired, or already-used code fails cleanly.**
   **Given** an invalid, expired, or previously-consumed reset code (or a new password failing the policy)
   **When** verification is attempted
   **Then** the reset fails with a generic, non-enumerating error, **no** password change occurs, **no** session is created, and the form surfaces the error without crashing. Repeated wrong attempts do not reveal whether the email/code combination is partially correct.

5. **A successful reset invalidates the account's other sessions.**
   **Given** a staff member who completes a password reset
   **When** the new password is set
   **Then** the user's pre-existing Convex Auth sessions are invalidated server-side (`authSessions` for that user are revoked, except the one the reset establishes if the provider signs them in) so a thief holding an old session is logged out — the server is authoritative; this is never trusted from the client. (NFR6; AR6′ equivalent of the original "invalidate existing sessions")

6. **The reset request and the completed reset are audited (FR17 / AR9).**
   **Given** a reset is requested and later a reset is completed
   **When** each event occurs
   **Then** an `auditLogs` row is written via the existing `auditLogs.record` path within the same transaction as the state change — `action` ∈ `auth.password_reset_requested | auth.password_reset_completed`, `entityType: "user"`, `actorId` = the resolved `Id<"users">` where known (e.g. the completed-reset event; the *request* event derives the actor by email lookup when the account exists, and writes **no** enumerating detail when it does not). No reset code, password, or hash is ever written to the audit row. (FR17, NFR8, AR9)

7. **The reset is reachable from the login screen and uses the existing UI primitives.**
   **Given** the Story-2.1 `/login` screen
   **When** the user clicks "Forgot password?"
   **Then** they reach a reset request form (email) and, on submission, a code + new-password form, both built from the existing `@/components/ui` primitives (`Input`, `Button`, `Card`) with React-Hook-Form + a Zod schema mirroring the server contract (UX only — server stays authoritative), wired to `useAuthActions().signIn("password", { flow: "reset", ... })` then `signIn("password", { flow: "reset-verification", ... })`. The Story-2.1 `ConvexAuthProvider` and shell are reused, not rebuilt.

8. **Build & tests stay green.**
   **Given** the changes
   **When** `pnpm typecheck` / `pnpm lint` / `pnpm test` run across the workspace
   **Then** all gates pass, including `convex-test`/RTL coverage for: the no-enumeration request response (unknown vs known email return the same shape), the audit-on-request and audit-on-complete writes, the invalid/expired-code failure path, and the session-invalidation-on-reset behavior. *(See the offline-scope caveat in Dev Notes — the `convex/_generated`, the live email provider, and the deploy steps require a Convex login + a real email key and are deferred; everything else is buildable offline.)*

## Tasks / Subtasks

- [ ] **Task 1: Add a reset-capable email provider to the Password provider (AC: #1, #3)** *(partially deferred — code offline-OK; live send needs a Convex login + email API key)*
  - [ ] In `convex/auth.ts` (created in Story 2.1), configure the `Password` provider with a **`reset` provider** that emails the one-time code — Convex Auth's documented pattern is `Password({ reset: ResendOTP })` (or an equivalent `Email`/OTP provider). Add the email provider module under `convex/` (e.g. `convex/ResendOTP.ts` implementing `Email`/`generateVerificationToken`), keeping the email API key (`AUTH_RESEND_KEY` or equivalent) in **Convex env vars**, never client-side.
  - [ ] **Verify the installed API** against `node_modules/.pnpm/@convex-dev+auth@*/...` — confirm the exact `Password({ reset })` option name, the `reset`/`reset-verification` flow string values, the `Email` provider shape, and the code-expiry config (these evolved across 0.0.x). Do not rely on the guide/doc snippets without checking the installed package. **[DEFERRED-online: a real send + the env key need a Convex login; author the provider + wiring now.]**
- [ ] **Task 2: `convex/passwordReset.ts` — audit hooks for request + completion (AC: #2, #6)**
  - [ ] An audited wrapper the web calls (or an auth-lifecycle callback if the installed version exposes one): on a reset **request**, look up the user by email via the `by_email` index (added in Story 2.1); if found+active, write `auditLogs` (`action: "auth.password_reset_requested"`, `entityType: "user"`, `actorId`); if not found/inactive, **return the same generic success without writing an enumerating row** (AC #2). On reset **completion**, write `auditLogs` (`action: "auth.password_reset_completed"`, `actorId` = the resolved user). Never include the code/password/hash in `before`/`after`.
  - [ ] Prefer `internalMutation` for the audit writers where they aren't directly client-invoked; reuse the `auditLogs.record` contract — no new audit fields.
- [ ] **Task 3: Session invalidation on successful reset (AC: #5)**
  - [ ] Confirm whether the installed Convex Auth `reset-verification` flow **already** revokes the user's other sessions (some versions do). If it does, document that and add a `convex-test` assertion. If it does **not**, add an `internalMutation` that, on completion, queries `authSessions` for the user (by the auth-tables user index) and deletes/revokes all but the current session, called from the completion path. **Verify the `authSessions` shape/index against the installed `authTables`** before writing the query.
- [ ] **Task 4: Web — forgot-password + reset-verification UI (AC: #2, #4, #7)**
  - [ ] Add a `/forgot-password` route (or a two-step flow on `/login`): **Step 1** email form → `useAuthActions().signIn("password", { email, flow: "reset" })`; on resolve, advance to **Step 2** regardless of whether the email exists (no-enumeration, AC #2). **Step 2** code + new-password form → `signIn("password", { email, code, newPassword, flow: "reset-verification" })`.
  - [ ] Build both forms from existing `@/components/ui` primitives (`Input`, `Button`, `Card`, Stories 1.3/1.4) + React-Hook-Form + a Zod schema mirroring the server contract (password policy mirrored for UX only). Add a "Forgot password?" link on the Story-2.1 `/login` screen.
  - [ ] Surface a generic success on request and a generic error on a failed verify (AC #2, #4); on success, route into the app shell (`/guest` default, Story 1.7) or back to `/login` per the provider's sign-in behavior. **Reuse** the Story-2.1 `ConvexAuthProvider` + shell — do not rebuild the provider stack or add route-group guarding (still deferred to Story 2.3).
- [ ] **Task 5: Tests (AC: #8)** *(backend tests deferred until `_generated` exists — needs one Convex codegen)*
  - [ ] `convex/passwordReset.test.ts` (or extend `convex/users.test.ts`) with `convex-test` + `t.withIdentity(...)`: (a) a request for a **known active** email writes the `auth.password_reset_requested` audit row; (b) a request for an **unknown/inactive** email returns the same generic shape and writes **no** enumerating row; (c) a completed reset writes `auth.password_reset_completed`; (d) other sessions are invalidated on completion. **Stub Convex Auth's code generation/verification + the email send** (`vi.mock`/`vi.stubGlobal`) — assert the **app-level** contract (no-enumeration, audit, session invalidation), not Convex Auth's internal hashing/OTP.
  - [ ] Web: RTL test that the request form renders + validates email, shows the generic success on submit (mock `useAuthActions`), and the verify form validates code + new-password and shows a generic error on a failed `signIn`.
  - [ ] Reuse the Story-2.1 `packages/backend/vitest.config.ts` (`edge-runtime`, scoped) — do not touch other packages' node-env configs.

## Dev Notes

### Convex specifics (authoritative — Convex Implementation Guide §Auth & RBAC)

- **Builds on Story 2.1 — do not rebuild.** The `users`/`...authTables` schema (incl. `by_email` index, `isActive`/`deletedAt`), `convex/auth.ts` (`convexAuth({ providers: [Password] })`), `convex/lib/auth.ts` (`requireAuthUser`/`getOptionalAuthUser`), the `auditLogs.actorId → v.id("users")` migration, and the web `ConvexAuthProvider` + `/login` all land in 2.1. This story **adds** the `reset` capability to the existing `Password` provider, the reset UI, and the reset audit/session-invalidation logic.
- **Tables touched:** none added. Reads `users` (by `by_email`) and `authSessions` (auth-tables-managed) for the no-enumeration lookup + session invalidation; writes `auditLogs` only. **No `passwordHash`/reset-token table** (AR6′ — Convex Auth owns the credential and the one-time code).
- **Functions:** `convex/auth.ts` gains the `Password({ reset })` config + the `convex/ResendOTP.ts` (or equivalent) email provider; `convex/passwordReset.ts` holds the audited request/complete wrappers + (if needed) the session-invalidation `internalMutation`. Client-facing surface is Convex Auth's `signIn("password", { flow: "reset" | "reset-verification" })` via `useAuthActions` — the app's own functions are the audit/session helpers.
- **The verification code IS the "time-limited reset token."** Convex Auth's `reset` provider generates, expires, and single-uses it; the app must never persist, log, or audit it. Expiry/length are provider config, not app state.
- **`v.*` validators are the server contract** — any app function declares `args` with `convex/values` validators; the web Zod schema mirrors them for UX only and is never trusted. No app function returns the code/password/hash.
- **Audit from mutations (AR9):** reset events write `auditLogs` rows; `actorId` derives from a server-side `by_email` lookup (request) or the resolved user (completion), never from un-validated client args. Reuse `auditLogs.record` — no schema change here.
- **No-enumeration is a hard requirement (AC #2/#4, NFR6):** the request path must return an identical response shape/timing for known vs unknown/inactive emails, and write no audit row that would reveal non-existence. Convex Auth's `reset` flow is designed to not leak; verify the installed version's behavior and don't add an app-level branch that reintroduces a leak (e.g. a distinct "user not found" error).
- **Session invalidation (AC #5):** confirm whether the installed `reset-verification` already revokes other `authSessions`; only add the manual revocation `internalMutation` if it doesn't. Verify the `authSessions` table shape + user index from the installed `authTables` before querying it.
- **RBAC is out of scope** (Story 2.3). Reset is unauthenticated by nature (the user has forgotten their password) — do **not** gate the reset endpoints behind `requirePermission`; the only server gate is the `isActive`/`deletedAt` check inside the email lookup (don't send to inactive accounts).

### ⚠️ Right-scope: buildable-offline vs deferred (honest, per Story 2.1)

The dev environment has **no Convex login** and **no live email provider key**, so anything needing a live deployment, codegen, or a real email send cannot complete here. Mirrors the deferral pattern from Stories 1.8 / 2.1.

- **Buildable offline (do now):** add the `Password({ reset })` config + the email-provider module (`convex/ResendOTP.ts`) and `convex/passwordReset.ts` (audit + session-invalidation logic); build the web `/forgot-password` (or two-step `/login`) UI + the "Forgot password?" link; author all test files (stubbing Convex Auth internals + email send).
- **Deferred — requires a Convex login / a real email key / a deploy (against `quixotic-boar-465`):**
  1. `convex/_generated/{api,server,dataModel}` does not exist until the first `convex dev`/`codegen` — so `convex/**` imports and backend typecheck won't resolve and `convex-test` cannot run until then (depends on the same 2.1 codegen step). Tests authored now, gated/excluded from CI until codegen runs.
  2. The email provider key (`AUTH_RESEND_KEY` or equivalent) + `SITE_URL` must be set as Convex env vars via the auth CLI / dashboard on the live deployment; a **real one-time-code email actually being delivered** can only be confirmed against a running deployment + a real inbox.
  3. Verifying the **installed** `Password({ reset })` option name, the exact `reset`/`reset-verification` flow strings, the `Email` provider contract, code expiry config, and whether `reset-verification` auto-revokes other sessions all require the package present + (ideally) a dev deploy. Do not mark AC #1/#3/#5 fully verified offline.
  4. End-to-end "request code → receive email → verify → new password works → old sessions dead" can only be confirmed against a running deployment with email configured. Call these out in the Dev Agent Record.

### Build on existing work — do not regress
- **Reuse Story 2.1** end-to-end: the `ConvexAuthProvider`, the `/login` screen (add the link), the `Password` provider (extend with `reset`), the `users` schema + `by_email` index, `auditLogs` (`record`/`by_actor`/`by_entity`). Keep the root-layout provider stack (`QueryProvider > ToastProvider > OfflineBanner > ConvexAuthProvider`) intact.
- **Reuse `@/components/ui` primitives** (1.3/1.4) for both reset forms. TanStack Query stays for non-Convex fetches only; reset state comes from Convex Auth's React hooks.
- **Do not** add route-group `(guest)`/`(staff)` guarding or permission-gated nav — that remains Story 2.3, consistent with Stories 1.7 and 2.1.

### Testing standards
- Backend: `convex-test` under `edge-runtime` (the scoped `packages/backend/vitest.config.ts` from 2.1), `t.withIdentity({ subject })` to fake auth where relevant, real `schema.ts` enforced; **stub** Convex Auth code-gen/verify + the email send. Web: Vitest + RTL + jsdom, mock `@convex-dev/auth/react` `useAuthActions`. Colocated `*.test.ts(x)`. Backend gated behind the 2.1 `convex codegen` per the offline caveat.

### Project Structure Notes
- **New (backend):** `packages/backend/convex/ResendOTP.ts` (or equivalent email/OTP provider module), `convex/passwordReset.ts`, `convex/passwordReset.test.ts`.
- **Modified (backend):** `convex/auth.ts` (add `Password({ reset: … })`); `packages/backend/package.json` only if the email provider needs a dep (e.g. `@auth/core` already present from 2.1; add nothing client-side). No schema change.
- **New (web):** a `/forgot-password` route + reset request/verify form components (or a two-step flow co-located with `/login`).
- **Modified (web):** the Story-2.1 `/login` screen (add the "Forgot password?" link). Root provider stack must not regress.
- **Variance:** epic ACs describe a self-minted reset-token table + manual session invalidation + argon2id; implemented as Convex Auth's `reset`/`reset-verification` flows per AR6′ (documented in the banner). `(guest)`/`(staff)` guarding + RBAC remain deferred to Story 2.3. No changes to `apps/api` (superseded stack).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.2] — user story + the two original (token/argon2id-framed) ACs; Epic 2 scope (FR55, FR17; NFR6, NFR8). FR55 = auth incl. password reset (epics.md line 100).
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend-Platform-Addendum] — AR6′ (Convex Auth replaces JWT/refresh/argon2id + owns hashing & one-time codes; RBAC moves in-function), AR9 (audit unchanged).
- [Source: _bmad-output/planning-artifacts/data-model.md#R1-—-Identity-&-Access] — `User` (`email @unique`, `isActive`, `deletedAt`), the dropped `passwordHash`/`RefreshToken` (Convex Auth owns credentials + sessions), the Convex mapping banner.
- [Source: Convex Implementation Guide §Auth & RBAC] — `convexAuth({ providers: [Password] })`, `getAuthUserId`, `authTables` (incl. `authSessions`), `requirePermission` precedent; gotchas (verify installed signatures, `@auth/core` peer, env keys via `npx @convex-dev/auth`, no DB unique constraints — `email` uniqueness enforced in-mutation).
- [Source: Convex Implementation Guide §Testing (convex-test)] — scoped `edge-runtime` vitest config, `t.withIdentity`, `_generated` must exist first; stub external sends in actions.
- [Source: _bmad-output/implementation-artifacts/2-1-staff-authentication-with-jwt.md] — the auth scaffold this story extends: `convex/auth.ts`, the `users`/`authTables` schema + `by_email` index, `convex/lib/auth.ts`, the `auditLogs.actorId` migration, the web `ConvexAuthProvider` + `/login`; the offline-scope deferral pattern and the deferred RBAC/route-guard split.
- [Source: packages/backend/convex/{schema.ts,auditLogs.ts,health.ts}] — the scaffold conventions; `auditLogs` table/indexes + the `record`/`listForEntity` contract reused for the reset audit rows.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
