---
baseline_commit: 088c4c7af8d3ecab31f1e523e51c546a4ac3e5ed
---

# Story 2.2: Account recovery — delegated to ByteAuth (was "Password reset")

Status: superseded-thin

> **⚠️ Superseded by the SSO direction (read this).** This story was a
> FammyComfort-owned password-reset flow (originally a self-minted reset token,
> then reframed to Convex Auth's `Password({ reset })`). Under the locked Epic 2
> direction (`docs/integrations/bytestay-fammycomfort-epic2-spec.md`),
> **FammyComfort owns no credentials** — staff authenticate through the Bytebazaar
> **ByteAuth** SSO handoff. ByteAuth owns **password, OTP/magic-link login, and
> account recovery** (its `auth/magicLink.ts` sends a 6-digit SMS code; `auth/
> password.ts` is set/clear-only — the magic-link IS the recovery path). Building
> a parallel reset flow in FammyComfort would duplicate and fork the credential
> store, which the SSO model exists to avoid.
>
> **What remains (thin redirect):** FammyComfort only needs to send an
> **unauthenticated** user back to ByteAuth/BytePlane to sign in (where
> forgot-password / OTP live). No reset UI, no email/OTP provider, no
> `passwordHash`, no `auth/password` flows on this side.

## Story

As a staff member who is signed out (or whose session expired),
I want a clear "sign in" affordance that takes me to ByteAuth,
so that I can authenticate (including recovering a forgotten password via
ByteAuth's OTP) and return to ByteStay — without FammyComfort holding any
credentials.

## Acceptance Criteria

1. **No FammyComfort-owned credential or reset flow exists.** There is no
   `Password` provider, no reset/OTP provider, no `passwordHash`, and no
   reset/forgot routes in `apps/web`. The only sign-in path remains the Story-2.1
   `sso-handoff` provider. (spec §1, §4)

2. **A thin "sign in via ByteStay" redirect affordance exists.** An
   unauthenticated landing affordance points the user to BytePlane/ByteAuth
   (env `NEXT_PUBLIC_BYTEPLANE_URL`), where ByteAuth handles login + OTP +
   forgot-password. From there the BytePlane ByteStay tile re-issues an SSO
   handoff back into FammyComfort (Story 2.1). If the env is unset, the affordance
   degrades to an explanatory message (no broken link).

3. **Recovery is explicitly ByteAuth's.** The affordance/help copy directs
   "forgot password?" to ByteAuth (it is not handled in FammyComfort). No
   account-existence information is surfaced by FammyComfort (no enumeration —
   FammyComfort never sees the email/password).

4. **Wired in by route-guarding (Story 2.3).** The trigger that *sends* an
   unauthenticated user to this affordance is the `(staff)` route guard, which
   lands in Story 2.3. This story provides the affordance + env; 2.3 connects the
   guard to it. (consistent with the 2.1/1.7 deferred guard split)

5. **Gates stay green.** `pnpm typecheck` / `lint` / `test` pass; a small RTL
   test asserts the affordance renders the ByteAuth link when the env is set and
   the fallback message when it is not.

## Tasks / Subtasks

- [ ] **Task 1: Thin sign-in redirect affordance (AC #2, #3, #5)**
  - [ ] `apps/web` `SignInRedirect` component/route (e.g. `app/signin/page.tsx`):
        reads `process.env.NEXT_PUBLIC_BYTEPLANE_URL`; renders a "Sign in via
        ByteStay" button linking there (with a "forgot password? recover it on
        ByteStay" note), or a fallback message when unset. Built from existing
        `@/components/ui` primitives.
  - [ ] Add `NEXT_PUBLIC_BYTEPLANE_URL` to `apps/web/.env.example`.
  - [ ] RTL test: link present when env set; fallback copy when unset.
- [ ] **Task 2: Connect to the route guard — DEFERRED to Story 2.3**
  - [ ] When the `(staff)` guard lands (2.3), redirect unauthenticated users to
        this affordance.

## Dev Notes

- **ByteAuth owns recovery.** Confirmed against `C:\Bytebazaar/convex/auth/`:
  `magicLink.ts` (`request`/`verify` — 6-digit SMS OTP, rate-limited) is the
  passwordless login + recovery path; `password.ts` only set/clear. There is no
  email "reset link" — logging in via OTP and re-setting a password is recovery.
- **No backend work on this side.** No `convex/auth.ts` change, no email/OTP
  provider, no schema change. The original reset ACs (reset token / argon2id /
  session invalidation) are entirely ByteAuth's concern now.
- **`NEXT_PUBLIC_BYTEPLANE_URL`** is the BytePlane launcher / ByteAuth login URL
  (cross-repo value — set when BB-1..BB-3 land; pairs with the spec §5 env).

### References
- [Source: docs/integrations/bytestay-fammycomfort-epic2-spec.md §1/§4/§5]
- [Source: C:\Bytebazaar/convex/auth/{magicLink,password}.ts] — ByteAuth recovery.
- [Source: 2-1-staff-authentication-with-jwt.md] — the `sso-handoff` sign-in path
  this defers recovery to; the deferred `(staff)` guard split (→ Story 2.3).

## Dev Agent Record

### Completion Notes List

### File List
