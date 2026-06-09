# Backup & Disaster Recovery — Fammy Comforts (Convex)

Story 1.10 baseline (NFR12). The backend is **Convex** — there is no Postgres `pg_dump`,
no Prisma migration backup, and no S3 backup bucket (superseded: AR4′/AR7′/AR8′).
Recoverability rests on **three layers**.

**Deployments:** dev `quixotic-boar-465`, prod `notable-cod-441` (project `bry-code/sommycomfort`).

## Recovery layers

1. **Convex managed snapshots + point-in-time history** (platform). Convex retains
   automatic backups/history on the deployment — verify the exact window/retention
   available on the current plan from the dashboard (see "Deferred").
2. **App-owned scheduled export** (`convex/crons.ts` → `internal.backups.dailyExport`).
   A daily `convex export` artifact is stored in Convex file storage and ledgered in
   the `backupRuns` table, so we hold an **independent** copy not reliant solely on
   the platform. Retention: **`RETENTION_COPIES = 30`** most-recent completed copies
   (`convex/backups.ts` `prune`, which also deletes the underlying blob).
3. **This runbook** — the documented restore procedure + targets below.

## Targets

| Metric | Target | Source |
|---|---|---|
| **RPO** (max data loss) | **≤ 24 h** via the daily export; **near-zero** where Convex PITR is available | daily cron + platform PITR |
| **RTO** (max time to restore) | **≤ 2 h** to a verified deployment (import/restore + smoke check) | runbook below |
| Retention | 30 daily export copies | `RETENTION_COPIES` |

## Restore drill (non-prod — execution deferred until a Convex login is available)

Run this against a **scratch / dev** deployment (never prod) to prove recoverability.

1. **Pick a source artifact.** From the dashboard or `npx convex run backups:listRecent`,
   choose a recent `completed` `backupRuns` row (or a platform snapshot timestamp).
2. **Provision a scratch deployment** (or reset the dev deployment `quixotic-boar-465`).
3. **Import the export:**
   ```bash
   # from packages/backend, against the scratch deployment
   npx convex import --replace path/to/export.zip
   # OR platform restore-to-point-in-time from the dashboard
   ```
4. **Verify a known entity round-trips.** Confirm the data is queryable, e.g.:
   ```bash
   npx convex run health:check          # deployment reachable
   npx convex run auditLogs:listForEntity '{ "entityType": "backupRun", "entityId": "<id>" }'
   ```
   Assert at least one expected `auditLogs` / `backupRuns` row is present and correct.
5. **Sign-off checklist:**
   - [ ] Import/restore completed without error
   - [ ] `health:check` returns `{ status: "ok" }`
   - [ ] A known pre-backup entity is present and matches
   - [ ] Time from start → verified ≤ RTO target
   - [ ] Drill date + operator recorded below

| Drill date | Operator | Source artifact | Result | Time-to-restore |
|---|---|---|---|---|
| _pending first drill_ | | | | |

## Deferred (needs the authed live deployment — tracked in `deferred-work.md`)

- Run a real `convex export` and confirm artifact bytes + `sizeBytes`.
- Confirm the cron fires on schedule (registration only takes effect on `convex deploy`).
- Verify Convex managed-snapshot / PITR availability + window on the current plan.
- Verify retention end-to-end (prune deletes blobs beyond 30).
- **Execute** this restore drill and fill the sign-off table.
- Failure alerting on a `failed` `backupRuns` row (later epic — notifications).
