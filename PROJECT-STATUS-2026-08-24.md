# Fammy Comforts — Project Findings & Next Steps

**Assessment date:** 2026-08-24 · **last revised 2026-08-26** (see §1.1 and §1.2)
**Assessed against:** working tree at commit `c61d12f` (2026-07-15, "feat(booking): swipeable room photo gallery + toast login errors"), branch `main`
**Method:** direct code inspection. Every figure below was counted from source, not taken from existing docs. Figures were **re-counted on 2026-08-25**; two were wrong and are corrected below. From 2026-08-26 onward, claims about types are additionally **compiler-verified** — see §8, which was wrong about this and is now corrected.

---

## 1. Headline: the app is essentially built; the docs and tracker are what's broken

Fammy Comforts (brand **ByteStay**, internal slug `rental`) is a mobile-first accommodation/rental-operations PWA for a Kenyan guest-house / serviced-apartment business. It is **feature-complete across all ten planned epics** — 68 of 69 stories done — and is deployed live on Convex production plus Vercel.

There is deliberately **no Epic 11**. The remaining work is go-live hardening, cleanup, and two business actions only you can perform.

The single most misleading thing in the repository is its own documentation. `README.md` and everything in `docs/` describe a stack that was abandoned in June.

---

## 1.1 Done / not-done ledger — as at 2026-08-25

Two working days have passed since this document was written. Everything below was re-verified against source on 2026-08-25, not carried forward on trust.

### Closed since 2026-08-24

| # | Item | Evidence |
|---|---|---|
| §5 P1 | Backup **export** wired; daily cron live at 21:00 UTC / 00:00 EAT | `backups.ts` walks every table, paginates at 200, encodes via `convexToJson`; `crons.daily` present in `crons.ts` |
| §5 P1.1 | Restore **tooling** now exists | `packages/backend/scripts/split-backup.mjs` splits the artifact into per-table JSONL — *but see "still open", the runbook was never updated to mention it* |
| §11.1 | HostPinnacle SMS gateway rewritten and **sending for real** | `lib/hostpinnacle.ts` + 15 tests; live send confirmed by brycode 2026-08-25 |
| §11.1.3 | Env var names documented | 7 `HOSTPINNACLE_*` entries in `packages/backend/.env.example`, names only, no values |
| §11.7 Q1 | Sender ID settled | `AMMY_HOPES` — confirmed, and distinct from the userid |
| §11.7 Q2 | Credential field settled | the issued value goes in `password`; code reads `HOSTPINNACLE_PASSWORD` |
| §11.7 Q3 | SMS config scope settled | platform-wide Convex env vars, not per-org DB rows |
| **new** | **Dynamic SMS message rendering** — was not in this document at all | see §11.8 |

### Still open, unchanged since 2026-08-24

Every one of these was re-checked and is genuinely still outstanding — none were quietly fixed:

| Area | Verified state on 2026-08-25 |
|---|---|
| `BACKUP.md` restore procedure | still says `npx convex import --replace path/to/export.zip`; sign-off table still reads *pending first drill*. The split script exists but the runbook doesn't reference it |
| Restore drill | never executed |
| Backup failure alerting | nothing queued on the failure path |
| `prune` | still `.collect()`s the whole `backupRuns` table and still filters to `completed`, so `failed` rows accumulate forever |
| `apps/api` + `packages/db` | both still on disk and still in the Turbo graph |
| `deploy.yml` | still Docker + Prisma; still no `convex deploy` step |
| M-Pesa live test | no Daraja call has ever fired |
| SSO browser round-trip | Story 2.1 still open |
| STK status poller | no `stkpushquery` reference anywhere in source |
| `middleware.ts` / CSP | does not exist; `next.config.ts` has no `headers()` — so no CSP, HSTS, `frame-ancestors`, or `Referrer-Policy` |
| Auth rate limiting | no rate-limit, lockout, or attempt-counting logic in `auth.ts` |
| PNG / Apple PWA icons | `apps/web/public/` holds `icon.svg` and `maskable-icon.svg` only — this **blocks §11.6** |
| `not-found.tsx` / `loading.tsx` | neither exists |
| TanStack Query | still exactly one file (`query-provider.tsx`), zero consumers |
| Audit-log readability (§11.3) | ✏️ *superseded 2026-08-26 — **done**, see §1.2 and §11.3* |
| Room upload/edit cleanup (§11.4) | untouched |
| Stale in-code comments (§6) | `schema.ts` still says it "defines only `auditLogs`" (it defines 39 tables); `workspaces.ts` still says "Auth/RBAC do not exist yet (Epic 2)" |
| `notificationsFeed` | five unbounded `.collect()` calls — same class of bug as `prune` |
| `sprint-status.yaml` | still `last_updated: 2026-06-04`, still `epic-2: in-progress` |
| **Nothing is committed** | HEAD is still `c61d12f` from 2026-07-15. ✏️ *2026-08-26 — still true, but the commit is now packaged and ready to run: see §12* |

### Two corrections to this document

1. §9 claimed `sprint-status.yaml` reads `last_updated: 2026-06-14`. It actually reads **2026-06-04** — the drift is ten days worse than stated, and predates the Epic 10 retro rather than following it.
2. §2's counts were accurate when written but have since moved. Corrected in the table below.

### The one thing to be uneasy about

`guestBookings.create` is a **public, unauthenticated, unrate-limited** mutation that now renders and queues real billable SMS under the approved `AMMY_HOPES` sender ID. Before 2026-08-25 the worst an abuser could do was fill a queue that never drained. That is no longer true. This is a credit-burn and sender-ID-revocation risk and it is not yet mitigated. It belongs above most of §5 in priority.

---

## 1.2 Done / not-done ledger — as at 2026-08-26

Three problems were reported from the live site and all three are implemented. This batch is **compiler-verified**, which no previous batch was.

### Closed on 2026-08-26

| # | Item | What was wrong | Evidence |
|---|---|---|---|
| new | **Opaque Convex errors** — `[CONVEX M(rooms:update)] Server Error <request id>` when editing a room | A plain `throw new Error(...)` in a Convex function is **redacted on production deployments**. The message never leaves the server; the client only ever receives "Server Error" plus a request id. `ConvexError` is the documented exception — its `data` is always delivered | every user-facing throw now routes through `userError()` (`convex/lib/errors.ts`), which throws a `ConvexError`; 189 call sites across 32 backend modules |
| new | **Errors were invisible to the user** | Failures were swallowed or shown as raw strings inline | `components/ui/toast.tsx` gained info/success/error variants, `role="alert"` + assertive `aria-live`, sticky errors, same-message dedupe, and a module-level `notify()` bridge; new `lib/report-error.ts` (`reportError` / `reportSuccess`) wired into 9 pages |
| §11.3 | **Audit log unreadable** — the table literally printed `roomType.create · roomType · n572z146… · ks7c4ac8` | All three columns rendered the stored row verbatim: a dotted action name, a table name plus truncated document id, and a truncated user id | new `convex/lib/auditFormat.ts` (pure, ~280 lines) + rewritten `convex/audit.ts`; `/admin/access` and the `/admin` activity feed rebuilt against the resolved fields. See §11.3 |
| new | **🔒 Two unauthenticated audit-log holes** | `auditLogs.record` was a **public mutation** that inserted arbitrary rows — any client could forge audit entries or write unbounded. `auditLogs.listForEntity` returned **any org's** history for any entity id, with no auth at all. Both were pre-Convex-Auth leftovers | `record` is now an `internalMutation`; `listForEntity` requires `Audit logs:read` and filters to the caller's org. Zero callers existed anywhere in `apps/` or `packages/`, so no behaviour changed. See §11.5 |
| §8 | **Sandbox toolchain assessment was wrong** | §8 claimed the sandbox cannot run any of the toolchain. `tsc` in fact runs fine | `packages/backend` (65 files) and `apps/web/src` (76 files) both typecheck to **0 errors**. §8 rewritten |
| new | Portal username removed from the repo | `.env.example` printed `npx convex env set HOSTPINNACLE_USER_ID ammyhopes` — half of the portal login, in a possibly-public repo | now `'<portal username>'` |
| new | Release packaged | Nothing was committable without either `git add -A` churn or 74 hand-typed paths | `release/2026-08-26/` — `files.txt`, `message.txt`, `push.ps1`. See §12 |

### What "compiler-verified" means, and what it does not

`tsc --noEmit` is clean for both packages, each confirmed against a deliberately injected type error first (a clean run means nothing if the config silently compiled zero files). One of those probes — `r.entity.notAField()` — additionally proved the new `AuditRow` type flows from the backend through `@fammycomforts/backend` into the admin page, so the frontend and backend agree on the shape.

**Not verified:** `pnpm lint` and `pnpm test`. Vitest cannot execute in the sandbox — its own dependencies inside `.pnpm` are broken Windows symlinks (§8). CI runs both on push. `audit.test.ts` and `guestBookings.test.ts` were typechecked and their existing assertions are compatible with the new return shapes, but they have not been *run*.

### Still open after this batch

Unchanged: everything in the §1.1 "still open" table except audit-log readability. The priority order in §10 still holds, with `guestBookings.create` rate limiting first.

**One new find, deliberately not fixed here:** `apps/web/e2e/smoke.spec.ts` has been failing on `main` since July. It asserts `/` redirects to `/guest` with an `h1` of "Guest Booking"; HEAD's own `app/page.tsx` sends signed-out visitors to `/book` and no workspace carries that title any more. `ci.yml` runs it ungated, so the Playwright job is red independently of this release. Left alone on purpose — a three-line test correction belongs in its own commit, not inside a 74-file release. See §12.3.

---

## 2. Verified architecture (what the code actually is)

| Layer | Reality | Verified |
|---|---|---|
| Monorepo | pnpm 10.33.0 + Turborepo, `engines.node >= 24`, `.nvmrc` = 24 | ✅ |
| Web | `apps/web` — Next.js **16.2.7**, React **19.2.4**, Tailwind v4, Serwist PWA | ✅ |
| Web routes | **27** `page.tsx` files under App Router | ✅ re-counted 08-25 |
| Backend | `packages/backend` — **Convex is the entire backend** | ✅ |
| Convex schema | **39** app tables + spread `authTables` | ✅ re-counted 08-25 |
| Convex modules | **46** top-level function modules (+ `schema.ts`) and **13** `lib/` helpers | ⬆️ was 11 helpers — `hostpinnacle.ts`, `messageTemplates.ts` added |
| Convex functions | **177** exported (63 query, 79 mutation, 3 action, 6 internalQuery, 22 internalMutation, 4 internalAction) | ⬆️ was 173 |
| Tests | **56** test files | ⬆️ was 54 — `hostpinnacle.test.ts`, `messageTemplates.test.ts` added |
| Deployments | Convex dev `quixotic-boar-465`, prod `notable-cod-441`; web live on Vercel | ✅ |

New exports since commit `c61d12f`: `backups.exportNow`, `backups.exportPage`, `notifications.listTemplates`, `notifications.saveTemplate`, `notifications.previewTemplate`, `notificationsEngine.sendTest`.

### Dead weight still on disk

- **`apps/api` (NestJS 11)** — exposes exactly two endpoints (`GET /api/v1`, `GET /api/v1/health`). No auth, no guards, no domain logic. Its Socket.IO gateway checks only that a token *exists*, carries a `TODO(Epic 2): verify the JWT`, and never joins a room or emits an event. Unreachable dead infrastructure — realtime is delivered by Convex reactivity.
- **`packages/db` (Prisma)** — schema contains **1 model** (`AuditLog`) and **zero migrations**. `prisma migrate dev` has never been run.

Both were formally superseded by a dated decision: *"Backend pivot → Convex (2026-06-08)"*, which instructs their removal. That removal never happened, and both are still in the Turbo build/test graph.

---

## 3. Progress status

All ten epics built. Release plan R1 = Epics 1–6, R2 = 7–8, R3 = 9–10 — all three shipped.

| Epic | Title | Stories | Status |
|---|---|---|---|
| 1 | Platform Foundation & Design System | 11 | done |
| 2 | Identity, Access & Staff Management | 5 | **in-progress** (only 2.1 open) |
| 3 | Property, Rooms, Rates & Amenities | 5 | done |
| 4 | Guest Booking Experience | 8 | done |
| 5 | Payments, Invoicing & Reconciliation | 8 | done |
| 6 | Front Desk Operations | 8 | done |
| 7 | Operations & Housekeeping | 8 | done |
| 8 | Inventory & Procurement | 5 | done |
| 9 | Restaurant & Kitchen | 5 | done |
| 10 | Reporting, Exports & Notifications | 6 | done |

**Story 2.1 (staff auth / SSO)** is the only open story. The code is built, env is set, and prod↔prod connectivity was smoke-tested 2026-06-11. What remains is one manual browser tile→session round-trip.

---

## 4. Completed in July but never recorded

Work continued for a month after the last retro and the tracker was never updated. Two items previously listed as outstanding are in fact **done**:

- **`(staff)` route guard — DONE** (commit `fff113c`). `apps/web/src/components/shell/auth-gate.tsx` gates the whole `(app)` tree on the Convex Auth session: `AuthLoading` → splash, `Unauthenticated` → `router.replace("/signin")`, `Authenticated` → shell. Its own docstring identifies itself as "the gap-listed `(staff)` guard."
- **Global search — DONE.** New `packages/backend/convex/search.ts` + `apps/web/src/components/shell/global-search.tsx`, wired into `top-bar.tsx`.

Other July feature work: swipeable room photo gallery, "Powered by ByteBazaar" footer, room Edit/Update modal, staff edit, role-based customer landing (Home/Trips/Rewards/Profile), a new `browse/` section, admin god-mode nav, and a public `/book/fammycomforts` slug.

**Untracked new files** ✏️ *re-listed 2026-08-25 — now eleven, not five:*

*July feature work:* `apps/web/src/app/(app)/browse/page.tsx`, `apps/web/src/app/book/[orgSlug]/catalog.tsx`, `apps/web/src/components/pwa-updater.tsx`, `apps/web/src/components/shell/global-search.tsx`, `packages/backend/convex/search.ts`.

*August work:* `packages/backend/convex/lib/hostpinnacle.ts`, `packages/backend/convex/lib/hostpinnacle.test.ts`, `packages/backend/convex/lib/messageTemplates.ts`, `packages/backend/convex/lib/messageTemplates.test.ts`, `packages/backend/scripts/split-backup.mjs`, and this document.

Plus real (non-whitespace) modifications to `backups.ts`, `backups.test.ts`, `crons.ts`, `schema.ts`, `notifications.ts`, `notificationsEngine.ts`, `guestBookings.ts`, `guestBookings.test.ts`, `housekeeping.ts`, `demoAuth.ts`, `packages/backend/.env.example`, and `apps/web/src/app/(app)/admin/setup/page.tsx`.

---

## 5. Open work, in recommended priority order

### P1 — Backups: export now works. The **restore path does not.** ✏️ *revised 2026-08-25*

**Superseded.** The original finding here — `runExport()` throwing `"backup export not wired"` and the daily cron commented out in `crons.ts` — was fixed on 2026-08-25 (~14:16–14:20, uncommitted at time of writing). `runExport()` now walks every schema table via `backupTableNames()`, paginates at 200 docs, encodes each document with `convexToJson` (lossless for `v.int64()` money fields), and stores one JSON artifact in Convex file storage. The daily cron at 21:00 UTC / 00:00 EAT is live. `backups.test.ts` grew to 7 tests including an end-to-end `dailyExport` that reads the artifact back and asserts a `4096n` int64 survives the round-trip. Guards are sensible: 64 MB hard ceiling that fails loudly rather than truncating, 5000-page-per-table runaway stop, and `prune` deletes the blob as well as the row.

What replaces it, in severity order:

**1. 🟠 `BACKUP.md`'s restore procedure still cannot restore this artifact — though the tooling now exists.** ✏️ *revised 2026-08-25*

A helper was written on 2026-08-25: `packages/backend/scripts/split-backup.mjs` unpacks a `fammycomforts.backup.v1` artifact into per-table JSONL, keeping `_id`/`_creationTime` in a `.meta.jsonl` sidecar because `convex import --table` assigns fresh ones. That is the hard part solved.

What is **not** done: `BACKUP.md` step 3 still reads `npx convex import --replace path/to/export.zip`, which is the procedure for a Convex-native `.zip` and will not work on this envelope. The runbook does not mention the split script at all. So anyone following the documented procedure under pressure still fails. Downgraded from 🔴 to 🟠 only because the capability exists — **a backup nobody can restore is not a backup**, and right now the person restoring would have to find the script themselves.

**2. 🔴 Nothing alerts on a failed run.** `performBackup` re-throws so the failure reaches Convex's function logs, but scheduled *actions* are at-most-once with no auto-retry. A failed nightly export means no copy for that day and silence. **Now genuinely cheap to fix as of 2026-08-25:** queue an `outboundNotifications` row on the failure path — the SMS channel delivers, and §11.8's renderer means the row will carry a readable message rather than the literal words "backup failed".

**3. 🟡 Failed runs are never pruned, and `prune` will eventually break itself.** Re-verified 2026-08-25 — unchanged. `prune` filters to `completed` before slicing, so `failed` rows accumulate forever, and it calls `.collect()` over the entire `backupRuns` table, which will one day exceed Convex's per-query read limit and take pruning down with it. Bound the query and expire failed rows on their own window. `notificationsFeed` has five `.collect()` calls with the same defect — fix them together.

**4. 🟡 The artifact is not a point-in-time snapshot.** Each `exportPage` call is its own transaction, so writes landing mid-export can be captured inconsistently across tables — a booking without its payment row. Convex's managed snapshots (layer 1) are the consistent copy; this should be stated as a known property in `BACKUP.md` rather than left implicit.

**5. 🟡 `_storage` is still not backed up.** Guest ID documents and uploads live in `_storage`, which the export does not walk. Honestly documented in both the module docstring and `BACKUP.md` — but it is the most compliance-sensitive data in the system, so "documented" is not the same as "covered".

**6. 🟡 Peak memory.** All tables' encoded lines are held in memory, then `sections.join(",")` makes a second full copy, then the `Blob` a third. At the 64 MB ceiling that is roughly 200 MB in one action. Also `approxBytes` sums `line.length`, which counts UTF-16 code units rather than bytes, so non-ASCII guest names make the guard trip later than intended.

**7. 🟡 The restore drill still has never been executed** and `BACKUP.md`'s sign-off table still reads *pending first drill*.

### P2 — Repo cleanup

Delete `apps/api` and `packages/db`; update `pnpm-workspace.yaml`, `turbo.json`, and `ci.yml` accordingly. Beyond tidiness this has real value: the dead Prisma/NestJS code is the main reason both humans and AI agents misread this project's architecture.

### P3 — Fix `.github/workflows/deploy.yml`

Still runs the abandoned stack: `docker/setup-buildx-action`, two `docker/build-push-action` steps, and `pnpm --filter @fammycomforts/db exec prisma migrate deploy`. There is **no `convex deploy` step at all**. It's inert (gated behind `vars.DEPLOY_ENABLED`), so this is misleading rather than dangerous. `apps/web/vercel.json` is the only working deploy path.

### P4 — M-Pesa live test *(needs you)*

The integration is fully built — `lib/mpesa.ts` (msisdn normalisation, whole-shilling enforcement, Nairobi timestamps, STK password, defensive callback parsing), `mpesa.ts` (per-org Daraja config, `initiateStk`, idempotent token-verified `processStkResult`), and `http.ts` (`POST /mpesa/callback/<token>`), with unit tests. **But STK Push has never fired against real Daraja.** Needs credentials entered at `/admin/payments`.

### P5 — SSO browser round-trip *(needs you)*

Point Bytebazaar prod's `NEXT_PUBLIC_BYTESTAY_URL` at the deployed web URL and click one real tile. This is the only thing keeping Story 2.1 open. It blocks real-tenant onboarding; the demo path already works.

### P6 — Polish

- **STK status-query poller missing** — confirmed no `stkpushquery` usage anywhere. Spec calls for a fallback poll ~90s after initiation, ~3 retries, then leave pending and flag.
- **No SSR/middleware auth guard** — no `middleware.ts` exists. Not a data leak (every Convex function enforces `requireOrgUser`/`requirePermission` server-side), so this is defence-in-depth and first-paint polish.
- Server-side PDF generation (currently print-pipeline only).
- Offline housekeeping mutation queue — see §7.
- **UI-REVAMP Phase 5:** Operations view, Housekeeping task board, Kitchen, admin overview module-cards, notifications panel, role switcher, AI assistant panel.

---

## 6. Dead code and loose ends

- **TanStack Query is mounted but unused** — `@tanstack/react-query` appears only in `query-provider.tsx`; zero consumers. Vestigial from Story 1.6.
- `WorkspacePlaceholder` component — imported by zero pages.
- `apps/api/src/common/zod-validation.pipe.ts` — used by no controller.
- `NEXT_PUBLIC_BYTEPLANE_URL` — declared in `.env.example` but never read in `apps/web/src`.
- `NEXT_PUBLIC_DEMO_ORG_SLUG` — read in code but documented in no `.env.example`.
- No `not-found.tsx`, no `loading.tsx`.
- No PNG/Apple PWA icons (SVG only).
- Web build pinned to `next build --webpack` because Turbopack can't emit the Serwist service worker.
- **Lighthouse PWA ≥ 90 (NFR1) has never been measured.**
- Stale in-code comments actively mislead: `convex/schema.ts` docstring says "only `auditLogs`" (it defines 39 tables); `apps/web/src/lib/workspaces.ts` says "Auth/RBAC do not exist yet (Epic 2)" (both fully built).

---

## 7. Open decisions that need your call

1. **PayBill vs Till** for `MPESA_TRANSACTION_TYPE` / `PartyB`. Blocks finalising the Daraja config.
2. **Does permission `manage` imply `write`/`read`,** or stay a discrete grant? Currently discrete — 18 areas × 3 actions, 12 base roles.
3. **Offline mutation queue design.** Convex's in-flight queue is in-memory only and does *not* survive a reload or app kill, and Serwist background sync cannot help because mutations travel over WebSocket rather than `fetch`. A durable IndexedDB queue plus a conflict-resolution policy is unbuilt — and the conflict policy itself was flagged as an unwritten spec back in June. This matters because housekeeping staff use this on phones with patchy signal.
4. **ID-number encryption mechanism** (pgcrypto vs application-level) — left unresolved by the Convex pivot. Relevant to guest ID documents already being stored.
5. **Production Daraja credentials** — when the business is ready.

---

## 8. Environment constraints (affects how we work, not the app)  ✏️ *rewritten 2026-08-26 — the previous version was wrong*

**What the previous version got wrong.** It said the sandbox "cannot execute this project's toolchain" and concluded that "code can be read, analysed and written here — it cannot be verified here." The second half is false. `tsc` is pure JavaScript and runs fine. Two batches of work were handed over unverified on that mistaken basis.

**The actual root cause.** `node_modules` was installed on Windows, so every top-level entry in `packages/backend/node_modules` (4) and `apps/web/node_modules` (31) is a Windows symlink whose target is unreadable from Linux: `readlink` returns empty, `ls`/`cat` give "Input/output error", and — misleadingly — `find -xtype l` reports zero broken links. The real packages are intact at `node_modules/.pnpm/<mangled>@<version>/node_modules/<name>`.

**What therefore works:** typecheck, via a scratch `tsconfig.json` written **outside the repo** that copies the real `compilerOptions` and adds `baseUrl` + `paths` pointing each dependency at its `.pnpm` realpath. Two non-obvious traps: a runtime package that ships no `.d.ts` (`react`, `react-dom`) must be mapped to its `@types/` twin, because `typeRoots` does not affect the per-module `node_modules/@types/x` walk-up and that walk-up dies on the broken link; and subpath exports need explicit entries (`@convex-dev/auth/providers/*` → `<pkg>/dist/providers/*.d.ts`). Skipping the second one cost hours: `schema.ts` failed to resolve `@convex-dev/auth/server`, `typeof schema` degraded to `any`, `DataModelFromSchemaDefinition` fell back to a generic data model, and **hundreds of plausible-looking type errors appeared in files that had not been touched**. One unresolved module can manufacture an entire fake regression.

**What still does not work:**

1. **Vitest cannot execute.** Its own dependencies inside `.pnpm` (`chai`, `debug`, `expect-type`) are broken links too. Test files can be *typechecked* — their only errors are missing ambient types (`import.meta.glob` wants `vite/client`, `process` wants `@types/node`), which are sandbox artifacts, not defects.
2. **No network.** A proxy returns 403 for the npm registry, GitHub and the SMS gateway. Nothing can be reinstalled, pushed, or called live from here.
3. Sandbox Node is v22.23.2; the repo requires ≥ 24. Irrelevant for `tsc`, relevant for `next build`.

**Consequence:** `pnpm lint`, `pnpm test` and `pnpm build` must run on Windows or in CI. Typecheck no longer needs to wait for either. Always run a negative control — inject a deliberate type error, confirm it is reported, restore it — before trusting a clean run.

**Git quirks, both real:**

- Every file committed to this repo is **LF**, but 38 of the 74 files in this release are **CRLF** in the working tree, and roughly 300 tracked files differ from HEAD by line endings alone. So `git status` and `git diff --name-only` are unusable as a change list. The true change set is computed by batch-reading HEAD blobs with `git cat-file --batch` and comparing bytes with `\r\n` normalised to `\n`. **Never run `git add -A` or `git commit -a`** — stage explicit paths only. `release/2026-08-26/push.ps1` does this, and normalises the staged files to LF first so the GitHub diff shows real changes rather than 38 whole-file rewrites.
- Edit files byte-level (read → `\r\n` → `\n` → edit → write back with the original terminator) rather than with line-oriented tools, and never trust a `$`-anchored regex on a CRLF file — the `\r` sits before the line end.
- There is no `.gitattributes` and `core.autocrlf` is unset locally, which is why the mismatch persists. Adding `* text=auto eol=lf` plus a one-time `git add --renormalize .` would end this permanently, but it produces a repo-wide diff and was deliberately **not** bundled into this release.

---

## 9. Documentation trust map

**Authoritative:** `_bmad-output/implementation-artifacts/sprint-status.yaml`, `epic-10-retro-2026-06-14.md`, `deferred-work.md`, and `planning-artifacts/architecture.md` (whose Convex addendum of 2026-06-08 binds over the older body).

**Structurally valid but backend-superseded (2026-06-04):** `epics.md`, `data-model.md`, `mpesa-daraja-integration-spec.md`, `implementation-readiness-report-2026-06-04.md`.

**Do not trust:**

- **`README.md`** — the most misleading file in the repo. Documents `apps/api` + `packages/db` as the architecture; never mentions `packages/backend`.
- **All of `docs/`** (`index.md`, `project-overview.md`, `architecture.md`, `component-inventory.md`, `development-guide.md`, `source-tree-analysis.md`) — generated from a 2026-06-04 scan of the pre-monorepo prototype era. They claim no backend, no database, no tests, no CI, and an entry point of `prototype/server.js`. All false; `prototype/` no longer exists.
- **`docs/DEPLOYMENT.md`** — useful runbook, but its "the web app isn't deployed yet" premise is obsolete.
- **`convex-implementation-guide.md`** — accurate on patterns, but repeatedly claims `@convex-dev/auth`, `convex-test` and `crons.ts` don't exist yet. All three do.

**Tracker drift:** `sprint-status.yaml` reads `last_updated: 2026-06-04` with `epic-2: in-progress`, despite a month of July commits and two days of August work. ✏️ *corrected 2026-08-25 — an earlier draft of this document said 2026-06-14; the file actually says 06-04, so the drift predates the Epic 10 retro rather than following it.* This is precisely the process debt that retro flagged. Its own action item — "add *update sprint-status.yaml* to every epic's definition of done" — was not adopted.

---

## 10. Suggested sequence  ✏️ *revised 2026-08-26*

The audit-log and error work has landed and is packaged for release, so steps 1 and 2 have collapsed into "run §12". Current recommendation:

1. **Run `release\2026-08-26\push.ps1`** (§12). It runs the CI-equivalent checks locally, stages the 74 real changes, commits, deploys Convex to production, then pushes. Typecheck is already green for both packages (§1.2); `pnpm lint` and `pnpm test` are what this step is actually for.
2. **Test on the live site** — the checklist the script prints at the end, or §12.3.
3. **Then `.gitattributes` + `git add --renormalize .`** as its own commit (§11.7 Q8), while the tree is clean and the diff is easy to reason about. Doing it now stops the next release repeating the same dance.
4. **Rate-limit `guestBookings.create`** (§1.1). It is a public trigger for billable SMS and remains the one genuine regression of the last three days.
5. **Rotate the HostPinnacle account password** (§11.1.3) and remove the orphaned `SMSLEOPARD_*` vars.
6. **Close out backups:** update `BACKUP.md` to reference `split-backup.mjs`, execute the restore drill, fill the sign-off table, add failure alerting, and bound `prune`. Fix `notificationsFeed`'s five `.collect()` calls in the same pass — same defect.
7. **Delete `apps/api` + `packages/db`**, then rewrite `deploy.yml` around `convex deploy`. Do these together — both touch root config and CI. Note that `deploy.yml` currently builds Docker images for the dead NestJS/Prisma stack and its `migrate`/`deploy` jobs are gated behind `vars.DEPLOY_ENABLED == 'true'`, which is why nothing has broken; `ci.yml` is the workflow that actually runs.
8. **Rewrite `README.md` and regenerate/retire `docs/`**, and fix the two stale in-code comments in `schema.ts` and `workspaces.ts` (§6), so the repo stops misleading its own contributors and tooling.
9. **Refresh `sprint-status.yaml`** and adopt the retro's definition-of-done habit.
10. **Your two business actions:** M-Pesa live sandbox test, SSO browser round-trip → closes Story 2.1 and, with it, Epic 2.
11. Then polish: STK poller, SSR middleware + CSP, raster PWA icons → install prompt (§11.6 depends on the icons), UI-REVAMP Phase 5, Lighthouse measurement.

---

## 11. Additional scope added before finalising the app

Added 2026-08-24 at brycode's direction. These sit alongside §5 and should be treated as release-blocking unless noted.

### 11.1 — SMS gateway: HostPinnacle / sender ID  ✅ **sending live as of 2026-08-25**

**Provider:** HostPinnacle (`https://smsportal.hostpinnacle.co.ke/SMSApi/send`)
**Account userid:** `ammyhopes` (lowercase)
**Sender ID:** `AMMY_HOPES` — confirmed 2026-08-24. Note it is *not* the same string as the userid.
**Config location:** platform-wide Convex environment variables (decided 2026-08-24), not per-org DB rows.
**Credential:** held outside this document — see §11.1.4.

Prior state: `SMSLEOPARD_ACCESS_TOKEN` / `SMSLEOPARD_SECRET` / `SMSLEOPARD_SENDER_ID` existed **nowhere in the repo** — no source file, no `.env.local`, no `.env.example`. They were set in the Convex dashboard and never read by any code. SMS Leopard was never actually wired; the config was orphaned. Those three variables can be deleted from both deployments (`npx convex env remove SMSLEOPARD_ACCESS_TOKEN`, etc.). Rotate/revoke them at SMS Leopard too — they were also pasted in plain chat.

#### 11.1.1 What was wrong with the old code

`notificationsEngine.drain` posted a shape no HostPinnacle endpoint accepts — `{ to, from, message }` with an `Authorization: Bearer` header, reading `SMS_GATEWAY_URL` / `SMS_API_KEY` / `SMS_SENDER_ID`. Eight blocking mismatches: bearer header vs `userid`+`password` in the body; `to` vs `sms[].mobile` (an array inside a batch array); `message` vs `sms[].msg`; `from` vs `senderid`; missing `msgType` / `sendMethod` / `duplicatecheck`; single vs batch payload; raw phone vs `254…`; and — the dangerous one — **only checking `res.ok`**, when HostPinnacle returns rejections as HTTP 200 with an error body. That last one meant every "Invalid Credentials" or "Sender ID not approved" was counted as a successful send and the 3-attempt retry never fired.

#### 11.1.2 What was implemented (2026-08-24)

- **New** `packages/backend/convex/lib/hostpinnacle.ts` — pure, IO-free helpers following the `lib/mpesa.ts` convention: `readHostPinnacleConfig`, `normalizeSmsMsisdn`, `buildSendPayload`, `interpretSendResponse`.
- **New** `packages/backend/convex/lib/hostpinnacle.test.ts` — 15 unit tests covering config defaults, phone normalization, payload shape, and response interpretation including the HTTP-200-rejection case.
- **Rewritten** the `sms` branch of `notificationsEngine.drain` to build the documented payload and to decide delivery from the **response body**, so gateway rejections now mark the row failed and feed the existing retry logic. The raw response is recorded in `outboundNotifications.error` (one line, capped at 300 chars).
- Comments in `crons.ts` and `schema.ts` that named the old `SMS_*` vars were corrected; `packages/backend/.env.example` now documents the `HOSTPINNACLE_*` names (names only, no values).

Three design calls worth knowing about:

**Own phone normalizer, not M-Pesa's.** `lib/mpesa.ts`'s `normalizeMsisdn` only accepts `07…` because STK Push is Safaricom-only. SMS is network-agnostic, so `normalizeSmsMsisdn` also accepts the `01…` range — otherwise every guest on an Airtel/Telkom `011…` number would be silently unreachable.

**One request per queued row, not a batch.** The `sms[]` array does support batching, and the code is shaped to allow it later, but per-row requests are what ship: the queue records delivery and drives retries *per row*, and this provider's batch response shape hasn't been observed against a live send. Mis-attributing a batch result would mean marking a booking confirmation "sent" when it wasn't — a silent failure. At 50 rows per 5-minute tick the extra requests cost nothing.

**`duplicatecheck` defaults to OFF.** This is a deliberate departure from the sample payload. HostPinnacle's duplicate window suppresses an identical message to the same number, which collides head-on with the queue's 3-attempt retry: a genuinely failed send would be dropped on retry and the guest would never get their confirmation. Worst case with it off is a guest receiving a duplicate; worst case with it on is a booking confirmation that never arrives. `HOSTPINNACLE_DUPLICATE_CHECK=true` re-enables it if the provider's window is later understood and accepted.

#### 11.1.3 Still to do  ✏️ *revised 2026-08-25*

- ~~Set the env vars~~ — **done.** Set on both deployments; a live send was confirmed by brycode on 2026-08-25.
- ~~Fire one real SMS and capture the response body~~ — **done.** The gateway accepted it and the row completed, so `interpretSendResponse`'s success list matches the real response shape.
- Run `pnpm --filter @fammycomforts/backend test` on Windows to confirm the suite passes. **Still outstanding** — it cannot be run from the assistant's sandbox (§8), and it is now the gate for two batches of work, not one.
- Consider a delivery-report webhook if HostPinnacle offers one; right now "sent" means "the gateway accepted it", not "the handset received it". **Still outstanding.**
- Remove the three orphaned `SMSLEOPARD_*` variables from both deployments. They appear in no source file (verified 2026-08-25 — only in this document and two planning docs), but they may still be set in the Convex dashboard: `npx convex env remove SMSLEOPARD_ACCESS_TOKEN` and so on, per deployment. Revoke them at SMS Leopard too; they were pasted in plain chat.
- Confirm whether `HOSTPINNACLE_PASSWORD` should be prod-only rather than set on dev as well.
- 🔴 **Rotate the HostPinnacle account password.** The value transmitted in chat is an *account login*, not a scoped API key — it carries billing access and sender-ID control. This is the highest-severity item in §11.1 and it is not yet done.

#### 11.1.4 🔒 Credential handling — action required

The 40-character key was transmitted in plain chat. **Treat it as compromised and rotate it with HostPinnacle.** It is deliberately **not recorded in this file** — this file is inside a git repository, and a committed secret persists in history until a force-push and history rewrite.

⚠️ **Open question:** HostPinnacle's documented payload has a `password` field, not an API-key field. Confirm with them whether the issued key *is* the value that goes in `password`, or whether the portal login password is a separate value. The code reads `HOSTPINNACLE_PASSWORD` and sends it as `password`, so whichever value is correct goes there.

Set on both deployments (dev `quixotic-boar-465`, prod `notable-cod-441`):

```
npx convex env set HOSTPINNACLE_USER_ID  ammyhopes
npx convex env set HOSTPINNACLE_PASSWORD '<rotated-secret>'
```

`HOSTPINNACLE_SENDER_ID` (default `AMMY_HOPES`) and `HOSTPINNACLE_API_URL` (default the documented endpoint) only need setting to override. Verify with `npx convex env list`.

### 11.2 — Safaricom Daraja: sandbox review & production go-live

STK Push is fully implemented but has **never fired against real Daraja** (§5 P4). Beyond entering credentials, Safaricom requires a review/go-live process before a paybill can accept live customer payments.

- Open a Daraja sandbox review request with Safaricom for STK Push against real booking guests.
- Resolve the **PayBill vs Till** decision (§7.1) first — it determines `TransactionType` and `PartyB`, and Safaricom will ask.
- Register the production callback URL: `https://notable-cod-441.convex.site/mpesa/callback/<callbackToken>`.
- Expect Safaricom to want evidence of correct idempotency and callback handling — already implemented in `processStkResult`, so this should demo well.
- Build the STK status-query poller (§5 P6) before go-live: without it, a guest whose callback is lost sits in `pending` with no resolution path.

### 11.3 — Audit logs are unreadable (raw IDs, not values)  ✅ **implemented 2026-08-26**

**What the admin was actually looking at.** Reported from `/admin/access`, verbatim:

```
Action            Entity                  Actor
roomType.create   roomType · n572z146…    ks7c4ac8
amenity.create    amenity · kx75mmn8…     ks7c4ac8
```

Three columns, none of them legible: a dotted machine action name, a table name plus a truncated document id, and a truncated user id. Useless for its actual purposes — dispute resolution, staff accountability, incident investigation.

**What was built.**

- **New `packages/backend/convex/lib/auditFormat.ts`** — pure, IO-free, following the `lib/` convention. `humanizeAction` turns `room.update` into "Room updated" via a ~50-entry verb-phrase table; `ENTITY_TABLES` maps entityType to table with **30 explicit entries** rather than pluralising, because English plurals lie (`amenity` → `amenities`, `property` → `properties`); `documentLabel` picks a label using an ordered field preference (`name`, `fullName`, `reference`, `number`, `title`, …); and `describeChanges(before, after)` produces the field diff.
- **Rewritten `convex/audit.ts`.** `list` now returns `actionLabel` ("Room type created"), `entityTypeLabel`, `entity` (`Room "101"`), `actor` (the staff member's name) and a pre-formatted `changes` array, alongside the machine `action` that the filter still uses. Lookups are memoized per call so a page of 100 rows touching the same room reads it once.
- **New `audit.entityTypes` query** backing a "Filter by record type" dropdown.
- **Rewritten `/admin/access` audit table**: When / Action / Record / Who / What changed, with diffs capped at three lines per row and a per-row "+N more" expander — a creation carries every column of the new document, so uncapped rows would be a wall of text.
- **`/admin` activity feed** now reads the same resolved fields instead of `a.action.replaceAll(".", " · ")`.

**Three decisions worth knowing about.**

**Resolve at read time, snapshot only where read time cannot work.** §11.3's original recommendation was to snapshot a label at *write* time everywhere. That was only half right. Snapshotting at write time on every mutation means the label reflects what was true at the time of the action — good — but it also means a typo in the snapshot logic is permanent, existing rows can never benefit, and every one of the ~40 audit call sites has to be edited and kept correct forever. Read-time resolution is retroactive, fixes itself when the formatter improves, and needs one code path. So resolution is read-time by default, **except at delete sites**, where the document is about to become unreachable and read-time resolution could only ever show a raw id. `amenities`, `assets`, `branches`, `roomTypes` and `rooms` now write `entityLabel` at delete time. `staff.remove_role` deliberately does not — the user document survives, so read-time resolution works. Snapshots always win over resolution when present, so a future decision to snapshot more aggressively needs no reader change.

**Diffs are formatted server-side, into strings.** `describeChanges` returns `from`/`to` as strings, not raw values. Partly for consistency (money goes through the shared exact `formatKesCents`, so `4500` renders as `KES 4,500` rather than minor units), but mainly because money is stored as `v.int64()` and **a raw `bigint` in a Convex query result is legal on the wire and then throws in `JSON.stringify` in the browser**. Formatting server-side removes the trap entirely. Noise fields (`orgId`, `actorId`, `_id`, `_creationTime`, `createdAt`, `updatedAt`) are dropped, booleans render as yes/no, and arrays render as "N items".

**`normalizeId` is not optional.** `auditLogs.entityId` is `v.string()`, and `ctx.db.get` *throws* on a malformed id rather than returning null. A single legacy or hand-written row would have taken the whole page down. Every lookup goes through `ctx.db.normalizeId(table, entityId)` first, which returns null instead of throwing.

**Schema change:** `auditLogs.entityLabel` and `auditLogs.actorLabel`, both `v.optional(v.string())`. Additive only — this is a live production schema.

**Migration decision, resolved:** historical rows are left as-is. They resolve at read time like everything else, and fall back to `Room type (deleted · n572z146…)` when the referenced document is gone — so old entries are readable without a backfill.

**Deploy-order note:** `list` still returns the raw `entityId` and `actorId` fields. They are not rendered any more; they are there so that deploying Convex before Vercel finishes building cannot break the currently-live frontend, which reads them directly.

### 11.4 — Room creation/editing and photo management needs cleanup

The room upload flow needs a cleaner editing experience. A room Edit/Update modal landed in commit `4fcd0f6`, so this is refinement rather than greenfield. Scope to confirm, but the likely gaps:

- Photo management after initial upload — remove, replace, and **reorder** images (the booking page now has a swipeable gallery, so display order is user-visible and matters).
- Set a designated cover/hero image.
- Clear validation and error messaging on the room form; avoid partially-saved rooms on failure.
- Upload progress and failure recovery for slow connections; note Convex file storage uses signed upload URLs, so a failed upload can orphan a `_storage` object — worth a cleanup path.
- Confirm edits propagate to the public catalog and the front-desk views.

*Needs a short clarification pass with brycode on exactly which part of the flow feels unclean.*

### 11.5 — Security hardening and penetration test

Requested: protection against phishing, plus a penetration test. Current known posture:

- **Strong:** every Convex function independently enforces `requireOrgUser`/`requirePermission`; multi-tenancy is enforced by an `orgId` + `by_org*` index on every tenant table; the M-Pesa callback is token-verified and idempotent; guest booking lookup is already anti-enumeration; passwords are PBKDF2.
- **✅ Closed 2026-08-26 — two unauthenticated audit-log functions.** `convex/auditLogs.ts` held two pre-Convex-Auth leftovers that the migration never revisited. `record` was a **public mutation** whose only argument validation was on shape: any client with the deployment URL could forge audit entries attributing actions to other staff, or write unbounded rows. `listForEntity` had **no auth check at all** and read through `by_entity`, which is not org-scoped — so any caller could read any organisation's history for any entity id. `record` is now an `internalMutation`; `listForEntity` requires `Audit logs:read` and filters to the caller's org after the index read. Both had **zero callers** anywhere in `apps/` or `packages/` (grepped before changing), so nothing in the app changed. Worth noting *why* this survived so long: the file is not `audit.ts`, which is the one everything actually uses, so it read like dead code and was never audited. **Do not widen `record` back to `mutation`** — an audit trail a client can write to is not an audit trail.
- **Gaps to close:**
  - **No security headers** — there is no `middleware.ts` and no `headers()` config, so no Content-Security-Policy, HSTS, `X-Frame-Options`/`frame-ancestors`, or `Referrer-Policy`. A CSP plus frame-ancestors denial is the single highest-value anti-phishing/clickjacking measure here, since the app is a login-bearing PWA.
  - **Rate limiting / brute-force protection** on the `phone-password` credential provider — verify what exists; PBKDF2 alone doesn't stop credential stuffing.
  - **SSO handoff token** is itself the bearer secret. Confirm it is strictly single-use, short-TTL, and that `consumeHandoff` is atomic against replay.
  - Dependency vulnerability audit (`pnpm audit`) — no evidence one has been run.
  - Confirm guest ID documents in `_storage` are not reachable via guessable/unsigned URLs.
  - Resolve the **ID-number encryption** decision (§7.4) — real ID documents are already being stored.
  - Then commission the external penetration test, *after* the above, so the engagement isn't spent reporting findings already known.

### 11.6 — PWA install prompt after successful login

After a successful sign-in, offer the user the option to install the PWA on their phone.

- Implement via the `beforeinstallprompt` event: capture and defer it, then present a dismissible prompt post-login rather than on first page load — intent is far higher once signed in.
- Persist dismissal so it isn't nagging on every login, and suppress entirely when already running standalone (`display-mode: standalone`).
- iOS/Safari does not support `beforeinstallprompt`, so it needs a separate instructional path ("Share → Add to Home Screen"). Given a Kenyan guest-house staff context this is likely a minority of devices, but housekeeping staff on iPhones would otherwise get no prompt at all.
- Depends on the **missing PNG/Apple icon set** (§6) — installability and the iOS home-screen icon need raster icons, not just SVG. This should be done first.
- A companion `pwa-updater.tsx` already exists (currently untracked) handling service-worker updates; the install prompt belongs beside it.
- ⚠️ *Clarify:* the request mentioned "a small scan" — confirm whether this means a QR code so a desktop user can scan to install on their phone, or simply a small prompt/banner.

### 11.7 — Open questions from this batch  ✏️ *revised 2026-08-26*

1. ~~Exact sender ID string~~ — **answered:** `AMMY_HOPES`. Note it is not the same string as the userid `ammyhopes`.
2. ~~Is the HostPinnacle credential used as `password`, or a distinct API-key field?~~ — **answered:** it goes in `password`; the code reads `HOSTPINNACLE_PASSWORD` and sends it as `password`. A live send confirms this.
3. ~~Platform-wide or per-organisation SMS credentials?~~ — **answered:** platform-wide Convex environment variables. Revisit only if a second property with its own sender ID is onboarded.
4. **Still open** — "small scan" in §11.6: QR code so a desktop user can scan to install on their phone, or just a prompt/banner?
5. **Still open** — which specific part of the room upload/edit flow feels unclean (§11.4)?
6. **Still open** — PayBill vs Till (§7.1). Blocks the Daraja config and Safaricom will ask.
7. **Still open** — should `guestBookings.create` be rate-limited by IP, by phone number, or gated behind a challenge? See the warning in §1.1: it is now a public trigger for billable SMS.
8. **New, still open** — adopt `.gitattributes` with `* text=auto eol=lf` plus a one-time `git add --renormalize .`? It would permanently end the CRLF/LF mismatch that makes `git status` unusable (§8), but it produces a repo-wide diff, so it was deliberately kept out of the 2026-08-26 release. Best done immediately *after* that release lands, as its own commit.
9. **New, still open** — should the audit log be paginated? It currently takes the most recent 100 rows with a record-type filter. Fine at present volume; a date range and cursor will be wanted once there are months of history.

### 11.8 — Dynamic SMS message rendering  ✅ **implemented 2026-08-25** *(was not in the original document)*

**The bug this fixed.** The template system was half-built. `notificationTemplates` existed with a permission-gated admin editor, and `schema.ts` promised `{{placeholders}}` were "filled at send time" — but `{{` appeared nowhere else in the backend. No renderer existed, `drain` never read templates, and `guestBookings.create` queued rows with no `body` at all. The engine's fallback was `n.body ?? n.type.replaceAll("_", " ")`, so once the gateway went live in §11.1, guests received a paid-for SMS reading literally **"booking confirmation"**. The template editor was decorative.

**Design decision: render at queue time, not send time.** The exact words sent to the guest are rendered and stored in `outboundNotifications.body` when the row is queued. A later template edit therefore cannot rewrite history, and the queue row is an audit trail of what was actually sent. `drain` is now a courier — it sends `body` verbatim and never substitutes anything.

What was built:

- **New** `packages/backend/convex/lib/messageTemplates.ts` — pure, IO-free, following the `lib/` convention. Exports `renderNotification` (custom template → built-in default → generic fallback), `renderTemplate`, `sanitizeVar`, `guestFirstName`, `unknownPlaceholders`, `defaultTemplate`, and `smsSegments`. Built-in defaults cover `booking_confirmation`, `check_in_reminder`, `check_out_reminder`, `payment_receipt`, `staff_alert`, and `task_assignment`.
- **New** `packages/backend/convex/lib/messageTemplates.test.ts` — 32 unit tests.
- **`guestBookings.create`** loads the org's saved template per enabled channel, renders it with the real booking values, and stores the result plus the resolved recipient.
- **`notificationsEngine.drain`** now fails a row loudly (`"No rendered body for … — queueing site did not render a message"`) rather than inventing a message from the type string.
- **`notifications.saveTemplate`** rejects unfillable placeholders, so a typo like `{{guestname}}` fails in the admin editor instead of becoming an SMS.
- **New** `notifications.previewTemplate` query — server-rendered preview using the same code path.
- **`schema.ts`** gained `outboundNotifications.subject` (optional, email only). Additive, so `convex codegen` must run before typecheck.

Two safety properties worth preserving if this is ever refactored:

**Single-pass substitution.** A guest whose name is literally `{{amount}}` gets their odd name back, not the booking total. Re-running the regex over its own output would leak field values into guest-controlled text.

**Sanitize inputs, don't truncate output.** Interpolated values are stripped of control characters, zero-width marks, bidi overrides and soft hyphens, collapsed on whitespace, and capped per variable (guest name 24 chars, property 32, and so on). The rendered message is never truncated — a long name cannot crowd out the reference number, and no message is ever cut mid-word.

**Cost note.** `smsSegments()` measures real billing: GSM-7 gives 160 characters per segment, but a single non-GSM-7 character — an em dash, a curly quote pasted from Word, an emoji — retunes the whole message to UCS-2 and collapses the budget to 70. All default SMS bodies are verified pure ASCII, and a test asserts it stays that way. Em dashes are permitted only in the email subject, where segments don't apply.

#### 11.8.1 Still to do

- **Run the suite on Windows.** The sandbox cannot execute this project's toolchain (§8). To avoid handing over unverified logic, the real `messageTemplates.test.ts` was executed under `node --experimental-strip-types` against a purpose-written vitest shim: **32 passed, 0 failed**. That is meaningful but it is *not* the project's harness — `pnpm --filter @fammycomforts/backend test` on Windows remains the gate. Run `npx convex codegen` first.
- **Wire the admin preview to `api.notifications.previewTemplate`.** The backend query exists but is not consumed. `apps/web/src/app/(app)/admin/setup/page.tsx` still carries its own `DEFAULT_BODIES`, `SAMPLE`, and `fillPreview` — verified still present on 2026-08-25. They were synced by hand to match the backend exactly, but that duplication is what drifted in the first place, and it will drift again.
- **`task_assignment` is absent from the admin editor's type list**, and `housekeeping.queueAssignmentNotice` hardcodes its body with `channel: "push"` (never billed). A default exists in the renderer if this is ever promoted to a real staff SMS.
- Extend rendering to the other flows the renderer already supports: OTPs, payment notifications, check-in/check-out reminders, cancellations, room verification. Only `booking_confirmation` is wired today — and note the queue is fed from exactly two places (`guestBookings.create` and `housekeeping`), so the payment flows do not queue anything at all despite what `notificationsEngine`'s old docstring claimed.

#### 11.8.2 Bugs caught during verification

Worth recording, because all three would have shipped and two were silent-cost defects:

1. **The sanitizer fused words.** `"Room\t202"` became `"Room202"` because control characters were deleted before whitespace was collapsed. Fixed by splitting the character class: invisibles are deleted, line breaks become spaces.
2. **An em dash in the `task_assignment` default** forced UCS-2, cutting that message's budget from 160 characters to 70 and roughly doubling its cost.
3. **A second em dash in the generic fallback** did the same for every notification type without a specific default.

---

## 12. Release 2026-08-26 — how to put this live  *(new)*

Everything since `c61d12f` (2026-07-15) is uncommitted: backups, the SMS gateway, the template renderer, global search, the browse catalog, the PWA updater, this document, and the audit-log + error work from 2026-08-26. That is **74 files** — 60 edited, 14 new.

`release/2026-08-26/` packages the whole thing. Nothing in that folder is committed; it is tooling, not source.

| File | What it is |
|---|---|
| `files.txt` | The 74 paths, grouped and commented. Each is prefixed `:(literal)` so git does not read the `[orgSlug]` directory name as a character class |
| `message.txt` | The commit message — one commit, sectioned by the four fixes plus the previously-unreleased work |
| `push.ps1` | The nine-step runner: guards → local checks → LF normalisation → stage → commit → Convex deploy → push → test checklist |

### 12.1 Run it

```powershell
cd C:\Users\brycode\Desktop\Nice_One\FammyComfort
.\release\2026-08-26\push.ps1
```

It prompts before the commit, before the production Convex deploy, and before the push. Useful switches: `-DryRun` (stage and show the diff, then stop), `-SkipChecks` (skip `pnpm lint/typecheck/test`), `-SkipConvex` (git only), `-WithBuild` (also run `pnpm build`), `-Yes` (no prompts). If PowerShell blocks it: `powershell -ExecutionPolicy Bypass -File .\release\2026-08-26\push.ps1`.

### 12.2 Why the order matters

**Convex must go live before the push.** `apps/web/vercel.json` sets `buildCommand` to `cd ../.. && pnpm turbo build --filter=@fammycomforts/web` — it builds the web app and nothing else. It does **not** run `convex deploy`, and `.github/workflows/deploy.yml` (which might have) is Docker/Prisma leftovers with its deploy jobs gated behind `vars.DEPLOY_ENABLED == 'true'`. So Convex is a manual step. The new frontend calls `api.audit.entityTypes`, which production does not have yet; pushing first would put a build live against a backend that cannot answer it. The script deploys Convex at step 7, before pushing at step 8.

The reverse order is safe, which is why it is the chosen one: `audit.list` still returns the old `entityId` / `actorId` fields, so the *currently live* frontend keeps working against the new backend for the few minutes Vercel takes to build.

**Why one commit and not several.** The changes are entangled — `audit.ts` needs `lib/auditFormat.ts`, `global-search.tsx` needs `search.ts`, `layout.tsx` needs `pwa-updater.tsx`, and `guestBookings.ts` carries both an error conversion and the template import. More importantly, this exact tree is the one that typechecks; splitting it would create intermediate commits nobody verified.

**Why the script normalises line endings.** 38 of the 74 files are CRLF in the working tree while every file in the repo is LF (§8). Staged as-is they would appear on GitHub as 38 whole-file rewrites, burying the real change. The script converts only the files it is about to stage. Pass `-NoNormalize` to skip that.

### 12.3 Then test on production

In order — the first two are the reported bugs:

1. `/admin/access` → **Audit log** tab. Columns should read When / Action / Record / Who / What changed; actions as "Room type created" not `roomType.create`; records as `Room "101"` not `roomType · n572z146…`; who as a staff name not `ks7c4ac8`. Check the record-type filter narrows the list, and that a row with many changes shows "+N more" and expands.
2. Rooms → edit a room → save. It should save; and when forced to fail (reuse an existing room number) it should show a **sentence in a red toast**, never `[CONVEX M(rooms:update)] Server Error`.
3. `/admin` → the recent-activity feed reads as sentences.
4. Delete an amenity, reload the audit log — the deleted record still shows its name, because the label is snapshotted at delete time.
5. Top-bar search: 2+ characters, results grouped by rooms / guests / bookings, org-scoped.
6. Sign in as a low-permission user and confirm the Audit log tab is hidden.

Watch [CI](https://github.com/bmoenga38/FammyComforts/actions) — it runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` on every push to `main`, and lint and test are the two that were not verifiable locally (§8). The Convex dashboard's log view is where `ConvexError` messages now show up in full.

**Expect the Playwright job to be red, and it is not this release's fault.** `ci.yml` has a second, ungated job that runs `apps/web/e2e/smoke.spec.ts`. That test asserts `/` redirects to `/guest` and that an `h1` reads "Guest Booking" — but HEAD's own `app/page.tsx` sends signed-out visitors to `/book`, and no workspace is titled "Guest Booking" any more (`WorkspaceSlug` is admin / front-desk / operations / housekeeping / kitchen). So the e2e job has been failing on `main` since the routing changed in July, independently of this work. This release does not touch `app/page.tsx` or the spec. It is a three-line test update, best done as its own commit rather than smuggled into a release. **A red e2e job does not block go-live** — Vercel builds from the push, not from GitHub Actions.

For the record, the only change this release makes to `lib/workspaces.ts` is one line: the customer "Book" nav item now points at `/browse` (the in-shell catalog) instead of `/book` (the public one).

### 12.4 If something is wrong

Revert the commit and push — the frontend rolls back with Vercel. The Convex change is additive (two optional schema fields, one new query) and safe to leave deployed; the old frontend does not know about any of it.


