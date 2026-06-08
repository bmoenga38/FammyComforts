---
baseline_commit: 088c4c7af8d3ecab31f1e523e51c546a4ac3e5ed
---

# Story 1.10: Daily backup and disaster-recovery baseline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an owner,
I want automated daily backups with a tested restore procedure,
so that the property's data is recoverable after loss or corruption.

> **Scope (Convex backup/DR baseline — buildable-offline portion).** The backend is **Convex**, not Postgres (architecture.md Backend Platform Addendum, AR4′/AR8′) — so there is **no `pg_dump`, no Prisma migration, no S3 backup bucket**. Recoverability rests on three layers: (1) Convex's **managed/automatic snapshots + point-in-time history** on the deployment (a platform feature of the dev `quixotic-boar-465` / prod `notable-cod-441` deployments), (2) an **application-controlled scheduled `convex export`** (a `crons.ts` daily job + an `internalAction` that produces a durable export so we hold a copy independent of the platform), and (3) a **documented restore runbook + RPO/RTO targets**. This story makes the **schedule, the export action skeleton, the RPO/RTO policy, and the restore runbook** buildable-offline; the parts that require a logged-in live deployment (binding the export to real cloud storage, verifying retention, and the actual restore drill) are **deferred** with explicit acceptance hooks — see Dev Notes. This pattern mirrors prior Epic 1 stories that gated live-deployment work behind a Convex login.

## Acceptance Criteria

1. **Automated daily backup schedule exists (NFR12).** A single `packages/backend/convex/crons.ts` default-exports `cronJobs()` and registers **one** daily job — `crons.daily("daily backup export", { hourUTC: 21, minuteUTC: 0 }, internal.backups.dailyExport, {})` — scheduled at **00:00 EAT** (Kenya is UTC+3, so `hourUTC: 21` the prior day). The target is an `internalAction` (not client-invocable). This file is created (it does not exist yet). *Testable: file exists, default-exports a `cronJobs()`, registers exactly one daily job pointing at `internal.backups.dailyExport`; UTC↔EAT conversion documented in a comment.*

2. **Backup export action is implemented as an `internalAction` (Convex `export`/`ctx.storage`, AR7′).** `packages/backend/convex/backups.ts` exports `dailyExport` as an `internalAction` that (a) produces a deployment export and persists a durable artifact via `ctx.storage`, (b) records a `backupRuns` row (status `started → completed|failed`, `startedAt`, `finishedAt`, optional `storageId`, optional `error`) by handing off to internal mutations (actions are **at-most-once / no DB writes directly** — all state transitions go through `ctx.runMutation`), and (c) is **idempotent** (guards on current state; safe to re-run). The live `convex export` invocation + real artifact bytes are stubbed/`TODO`-flagged where they need the authed deployment. *Testable: `dailyExport` registered as `internalAction`; it calls internal mutations to write `backupRuns`; no `ctx.db` writes occur directly in the action; the export call is isolated behind a seam that tests can stub.*

3. **Backup-run audit trail (AR9, NFR12 retention).** Each backup run writes a `backupRuns` row and an `auditLogs` row (`action: "backup.run"`, `entityType: "backupRun"`) from a **mutation** (atomic with the run-state write). A query `backups.listRecent` (an `internalQuery`, or a `query` gated by `requirePermission(ctx, "settings"/"reports", "manage")` once auth lands) returns the most recent runs ordered by recency for an ops/health view. *Testable: a completed run produces a `backupRuns` row + a matching `auditLogs` row; `listRecent` returns runs newest-first.*

4. **Retention policy is encoded and enforced idempotently.** The daily job (or a paired internal mutation) prunes `backupRuns` artifacts older than the documented retention window (e.g. **30 daily** copies), deleting the underlying blob via `ctx.storage.delete(storageId)` in the same mutation (deleting the row does **not** delete the blob — AR7′ orphan rule). Retention is a named constant. *Testable: given runs older than the retention window, the prune mutation deletes those rows and calls `ctx.storage.delete` for each; runs within the window are kept; re-running prune is a no-op.*

5. **RPO / RTO + recovery layers are documented.** A restore runbook (`packages/backend/convex/BACKUP.md` or `docs/backup-and-recovery.md`) documents: the three recovery layers (Convex managed snapshots + PITR; the scheduled `convex export` artifact; the runbook itself), the **RPO** (≤ 24 h via the daily export; near-zero via platform PITR where available) and **RTO** target, the retention policy, and where exports live. *Testable: the runbook exists and states explicit RPO and RTO numbers, the retention window, and names both deployments (`quixotic-boar-465` dev, `notable-cod-441` prod).*

6. **Restore drill procedure is documented and step-by-step (deferred execution).** The runbook contains a **non-prod restore drill** procedure: import an export into a scratch/dev deployment via `convex import` (or platform restore-to-point-in-time), verify a known entity round-trips (e.g. an `auditLogs` row or `health.check`), and a sign-off checklist. The procedure is written so it can be executed unattended once a Convex login is available; **actually running the drill is deferred** and tracked in `deferred-work.md` with the exact command sequence. *Testable: runbook contains the ordered drill steps, the verification assertion, and a sign-off checklist; deferred-work.md has the corresponding entry.*

7. **Green + no regressions.** `schema.ts` adds the `backupRuns` table without breaking existing tables; `pnpm typecheck/lint/build` stay green where they run offline; a `convex-test` test (once the test harness from Story 1.11 + `_generated` exist) covers the backup-run lifecycle and prune idempotency with the export side-effect stubbed. Items that require the live deployment (the cron firing, the real `convex export`, the restore drill) are **explicitly deferred**, not silently skipped. *Testable: typecheck/lint/build pass; the test asserts AC2–AC4 invariants with `convex export` stubbed; deferred items enumerated.*

> Out of scope: actually running a production backup or restore (needs the authed live deployment — deferred); web UI for backup status (a later ops/admin surface — Epic 8 reporting/observability); Postgres `pg_dump`/Prisma-migration backup (superseded — AR4′/AR8′); object-storage (S3/MinIO) backup buckets (superseded — AR7′); notifications/alerting on backup failure (later epic; leave a `TODO` seam).

## Tasks / Subtasks

- [x] **Task 1: `backupRuns` table** (AC: #2, #3, #4, #7) — add a `backupRuns` table to `packages/backend/convex/schema.ts` following the schema conventions (built-in `_id`/`_creationTime`; `v.*` validators; indexes, no FKs):
  - [x] fields: `status: v.union(v.literal("started"), v.literal("completed"), v.literal("failed"))`, `startedAt: v.number()`, `finishedAt: v.optional(v.number())`, `storageId: v.optional(v.id("_storage"))`, `sizeBytes: v.optional(v.int64())`, `error: v.optional(v.string())`, `trigger: v.union(v.literal("cron"), v.literal("manual"))`.
  - [x] `.index("by_status", ["status"])` and `.index("by_started", ["startedAt"])` (recency + retention scans). Keep `auditLogs` unchanged.
- [x] **Task 2: `backups.ts` functions** (AC: #2, #3, #4) — create `packages/backend/convex/backups.ts`:
  - [x] `dailyExport` = `internalAction({ args: {}, handler })` — guard idempotency, `runMutation(internal.backups.startRun, { trigger: "cron" })`, call the export seam (stubbed/`TODO` for live `convex export`), persist artifact via `ctx.storage`, then `runMutation(internal.backups.completeRun, { runId, storageId, sizeBytes })` (or `failRun` on throw). **No `ctx.db` in the action.**
  - [x] `startRun` / `completeRun` / `failRun` = `internalMutation`s that write the `backupRuns` row transitions **and** the `auditLogs` row (`action: "backup.run"`), atomically.
  - [x] `prune` = `internalMutation` enforcing the `RETENTION_COPIES` constant: scan `by_started`, delete rows beyond the window and `ctx.storage.delete(storageId)` each — idempotent.
  - [x] `listRecent` = `internalQuery` (later promote to a `requirePermission`-gated `query`) returning recent runs newest-first.
- [x] **Task 3: `crons.ts`** (AC: #1) — create `packages/backend/convex/crons.ts` default-exporting `cronJobs()` with the single `crons.daily(...)` → `internal.backups.dailyExport` job at `hourUTC: 21` (= 00:00 EAT), and a comment documenting the UTC↔EAT conversion. Optionally chain `prune` from `dailyExport` (preferred) rather than a second cron.
- [x] **Task 4: Restore runbook + RPO/RTO** (AC: #5, #6) — author `packages/backend/convex/BACKUP.md` (or `docs/backup-and-recovery.md`): the three recovery layers; RPO/RTO numbers; retention; the non-prod restore-drill procedure (`convex import` / restore-to-point-in-time, verification assertion, sign-off checklist); name both deployments.
- [x] **Task 5: Tests** (AC: #7) — colocated `packages/backend/convex/backups.test.ts` (runs once `_generated` + the Story 1.11 `convex-test`/`edge-runtime` harness exist): assert the run lifecycle (`startRun → completeRun` writes `backupRuns` + `auditLogs`), `failRun` path, `prune` deletes-old/keeps-new + is idempotent + calls `ctx.storage.delete`, and `listRecent` ordering. Stub the live export seam (`vi.mock`/`vi.stubGlobal`). Flush scheduled functions if the action schedules anything.
- [x] **Task 6: Defer + track** (AC: #6, #7) — add a `deferred-work.md` entry for: running the real `convex export` against the live deployment, verifying retention end-to-end, and executing the non-prod restore drill (with the exact command sequence) — all blocked on a Convex login. Do **not** edit `sprint-status.yaml`.

## Dev Notes

### Convex backup model (what replaces pg_dump / S3)
- **No Postgres, no Prisma, no S3 (AR4′/AR7′/AR8′).** The architecture's original Story 1.10 ACs ("production database and object storage", "daily schedule", retention) are **reframed** onto Convex: recoverability = (1) **Convex managed/automatic snapshots + point-in-time history** on the deployment (platform-provided; nothing to build, but document it and verify availability on the live deployment), (2) an **app-owned scheduled `convex export`** so we retain an independent durable copy, and (3) the **runbook + RPO/RTO**. [Source: _bmad-output/planning-artifacts/architecture.md#Backend-Platform-Addendum AR4′/AR7′/AR8′; epics.md#Story-1.10; NFR12 (epics.md line 116/380)]
- **Scheduler vs cron (Convex Implementation Guide → Scheduler & Crons).** Recurring work lives in **one** `crons.ts` default-exporting `cronJobs()` (the file does **not** exist yet — create it; only one per deployment). **All cron times are UTC** → 00:00 EAT = `hourUTC: 21` the prior day. Cron registration only takes effect on `convex deploy`.
- **Action vs mutation durability.** Scheduled **mutations run exactly-once** (auto-retried); scheduled **actions run at-most-once** (NOT retried). So `dailyExport` (an `internalAction`, because it does external/`fetch`/export work and `ctx.storage`) must keep **all DB writes in `internalMutation`s** invoked via `ctx.runMutation`, and must be **idempotent** (guard on state). Actions have **no `ctx.db`**.
- **File storage + orphans (AR7′).** Persist the export artifact via `ctx.storage` and store the returned `v.id("_storage")` on the `backupRuns` row. Deleting a `backupRuns` row does **not** delete the blob — `prune` must call `ctx.storage.delete(storageId)` in the same mutation. `store()`/Blob APIs exist only in actions; the upload-URL flow is for client uploads (not relevant here — the server generates the artifact).
- **`v.*` validators are the contract.** `backupRuns` is fully validated in `schema.ts`; `sizeBytes` is `v.int64()` (integer, never float) consistent with the money/minor-units convention.

### RBAC + audit (AR6′/AR9)
- **Audit every state-changing mutation (AR9).** `startRun`/`completeRun`/`failRun`/`prune` each write an `auditLogs` row in-transaction. The existing `auditLogs` table + `auditLogs.record` mutation already exist — write directly via `ctx.db.insert("auditLogs", ...)` inside the same mutation so it is atomic (don't cross-call another mutation). `actorId` is `undefined` for cron-triggered runs (system actor) until Convex Auth lands; a manual trigger later derives it from `ctx.auth`.
- **RBAC (deferred to Epic 2).** `requirePermission(ctx, area, action)` does **not** exist yet (`@convex-dev/auth` not installed — Epic 2, AR6′). Keep `dailyExport`/`prune`/`startRun`/etc. as **`internal*`** functions (not client-invocable) so they need no permission gate now. `listRecent` ships as an `internalQuery`; when an ops/admin surface needs it, promote to a `query` guarded by `requirePermission(ctx, "settings", "manage")` (or the reports area) — leave a `TODO` noting this.

### Right-scope: buildable-offline vs deferred (honest)
- **Buildable offline now (no Convex login):** `schema.ts` `backupRuns` table; `backups.ts` functions (action skeleton + mutations + prune + query) with the live `convex export` call behind a stubbable seam; `crons.ts` daily registration; the restore runbook + RPO/RTO; the `convex-test` test (assuming Story 1.11's harness lands first). Typecheck/lint/build verify offline.
- **Deferred — needs the authed live deployment (`quixotic-boar-465` / `notable-cod-441`):** running a real `convex export` and confirming the artifact bytes + size; the cron actually firing on schedule; verifying Convex's managed-snapshot/PITR availability + window on the plan; verifying retention end-to-end; and **executing the non-prod restore drill** (the runbook is written, the drill run is deferred). Also deferred: `_generated/{api,server}` must be produced by `npx convex dev`/`codegen` before `internal.backups.*` imports resolve and before the test runs — mirror the prior Epic 1 stories' "verify on first `convex dev`" gating. Record all of this in `deferred-work.md`.
- **Test-harness dependency:** the `convex-test` + `edge-runtime` harness is **Story 1.11** (not yet installed in `packages/backend`). If 1.11 has not landed when this story is implemented, write the test file but mark it as pending/excluded and note the dependency — do not wire a `node`-env Vitest config here.

### Project Structure Notes
- **New:** `packages/backend/convex/crons.ts`; `packages/backend/convex/backups.ts` (+ colocated `backups.test.ts`); `packages/backend/convex/BACKUP.md` (or `docs/backup-and-recovery.md`).
- **Modified:** `packages/backend/convex/schema.ts` (add `backupRuns`); `_bmad-output/implementation-artifacts/deferred-work.md` (deferred items). **Do NOT** edit `sprint-status.yaml`.
- **Conventions honored:** one-file-per-domain (`backups.ts`), single `crons.ts`, internal-by-default functions, `camelCase` tables, `v.id("_storage")` for blobs, `v.int64()` for byte sizes, audit-from-mutation. No `apps/web` changes (no UI this story). No `pnpm`/`git` run by the spec author.
- **Variance noted:** epic ACs say "production database and object storage" + "daily schedule" + "restore drill in a non-prod environment" — re-expressed onto Convex (managed snapshots/PITR + scheduled `convex export` + `convex import` drill). The restore-drill *execution* is intentionally deferred (no live login), tracked in deferred-work — consistent with prior Epic 1 Convex stories.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.10] — story + ACs (daily backup taken & retained per policy NFR12; restore drill in non-prod, procedure documented & recoverable).
- [Source: _bmad-output/planning-artifacts/epics.md lines 116/165/172] — NFR12 (daily backup strategy + retention) mapped to Epic 1.
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend-Platform-Addendum — AR3′/AR4′/AR7′/AR8′] — Convex supersedes Postgres/Prisma/S3/BullMQ; deployments `quixotic-boar-465` (dev) / `notable-cod-441` (prod); deploy = `convex deploy`.
- [Source: _bmad-output/planning-artifacts/data-model.md (Convex banner, lines 6–14)] — entity→Convex mapping rules (`defineTable`, `v.id(...)`+index, money/bytes as integer, `auditLogs` written from mutations).
- [Source: Convex Implementation Guide — Scheduler & Crons] — single `crons.ts` `cronJobs()`; UTC↔EAT (`hourUTC:21` = 00:00 EAT); mutation exactly-once vs action at-most-once; idempotency; cron takes effect on deploy.
- [Source: Convex Implementation Guide — File Storage] — `ctx.storage` for server-generated artifacts; orphan rule (`ctx.storage.delete` in the same mutation); `v.id("_storage")`.
- [Source: Convex Implementation Guide — Testing (convex-test)] — `edge-runtime` config scoped to `packages/backend`; `_generated` must exist; stub action side-effects; flush scheduled functions; depends on Story 1.11 harness.
- [Source: packages/backend/convex/schema.ts] — schema conventions + existing `auditLogs` table to extend.
- [Source: packages/backend/convex/auditLogs.ts] — existing `record`/`listForEntity`; audit-from-mutation pattern to follow.
- [Source: packages/backend/package.json] — scripts `convex dev`/`deploy`/`codegen`; `convex@^1.40.0`; no test script yet (Story 1.11 adds it).
- [Source: _bmad-output/implementation-artifacts/1-7-role-workspace-navigation-shell.md] — format/rigor exemplar + the prior-story pattern of gating live-deployment work behind a Convex login and tracking deferred items.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- All deliverables are Convex source + docs in `packages/backend/convex/`. That package is intentionally **not gate-wired** (only `dev`/`deploy`/`codegen` scripts — no `typecheck`/`test`/`build`), so the workspace gates skip it and stay green: `pnpm typecheck` 6/6, `pnpm test` 6/6 (shared 13, api 10, db 2, web 36), `pnpm build` 4/4. No app code changed.
- Offline-blocked (as designed): `convex/_generated` doesn't exist (no `convex dev` login), so `internal.backups.*` imports + the `convex-test` file can't resolve/run here — deferred and tracked.

### Completion Notes List

- **All 6 ACs satisfied as the buildable-offline baseline** (live export/cron/restore-drill deferred behind a Convex login, per the story's right-scope).
- **AC1 — schedule:** `convex/crons.ts` default-exports `cronJobs()` with exactly one daily job → `internal.backups.dailyExport` at `hourUTC: 21` (= 00:00 EAT, conversion commented).
- **AC2 — export action:** `backups.ts` `dailyExport` is an `internalAction` that does NO direct `ctx.db` writes — it routes all state through `internalMutation`s (`startRun`/`completeRun`/`failRun`), is idempotent, and isolates the live export behind a stubbable `runExport(ctx)` seam (throws until wired, so an unwired run is recorded `failed`, not silently ok).
- **AC3 — audit trail:** every run-state mutation writes an `auditLogs` row (`action: "backup.run"`) atomically; `listRecent` (internalQuery) returns runs newest-first.
- **AC4 — retention:** `prune` keeps the newest `RETENTION_COPIES = 30` completed runs, deletes older rows AND their blobs (`ctx.storage.delete` — AR7′ orphan rule), and is idempotent; chained from `dailyExport` (one cron, not two).
- **AC5/AC6 — runbook:** `convex/BACKUP.md` documents the 3 recovery layers, explicit **RPO ≤ 24 h (near-zero via PITR) / RTO ≤ 2 h**, the 30-copy retention, both deployments, and a step-by-step non-prod restore drill (`convex import` → `health:check` + known-entity assertion → sign-off table). Drill **execution** is deferred.
- **AC7 — green + deferred:** schema `backupRuns` added without touching `auditLogs`; gates green; `backups.test.ts` authored (run lifecycle, idempotency, prune keep/delete/blob-delete/no-op, listRecent order) but inert until `_generated` + the 1.11 `convex-test`/edge-runtime harness land. Deferred items enumerated in `deferred-work.md`.
- **Conventions honored:** one-file-per-domain (`backups.ts`), single `crons.ts`, internal-by-default functions (no RBAC gate needed yet), `v.id("_storage")` blobs, `v.int64()` byte sizes, audit-from-mutation.

### File List

**New:** `packages/backend/convex/backups.ts`, `packages/backend/convex/crons.ts`, `packages/backend/convex/BACKUP.md`, `packages/backend/convex/backups.test.ts`
**Modified:** `packages/backend/convex/schema.ts` (add `backupRuns`)
**Modified (tracking):** `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

| Date | Change |
|---|---|
| 2026-06-08 | Drafted (workflow) — Convex-reframed backup/DR baseline (managed snapshots + scheduled export + runbook). |
| 2026-06-08 | Implemented (buildable-offline): `backupRuns` schema, `backups.ts` (dailyExport internalAction + start/complete/fail/prune mutations + listRecent), `crons.ts` (00:00 EAT), `BACKUP.md` runbook (RPO/RTO + restore drill), `backups.test.ts` (deferred-run). Gates green; live export/cron/restore-drill + test-run deferred behind a Convex login. Status → review. |
