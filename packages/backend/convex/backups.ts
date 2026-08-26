import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import { v, convexToJson, type Value } from "convex/values";
import schema from "./schema";

/**
 * Backup / disaster-recovery baseline (Story 1.10, NFR12). The backend is Convex,
 * so recoverability rests on: (1) Convex's managed snapshots + point-in-time
 * history on the deployment, (2) this app-owned scheduled export that keeps an
 * independent durable artifact, and (3) the restore runbook (BACKUP.md).
 *
 * Durability rule (Convex Implementation Guide → Scheduler & Crons): scheduled
 * MUTATIONS run exactly-once (auto-retried); scheduled ACTIONS run at-most-once.
 * So `dailyExport` is an `internalAction` (it does export/storage work) and keeps
 * ALL database writes in `internalMutation`s via `ctx.runMutation`, and is
 * idempotent (state-guarded).
 *
 * Two documented gaps, both called out in BACKUP.md — neither is a reason to
 * keep the cron off, but both must stay visible:
 *  - **File storage is not included.** Guest ID documents and other uploads live
 *    in `_storage`, which this export does not walk. Only the database is
 *    covered.
 *  - **The artifact lives in the deployment it backs up.** That protects against
 *    accidental deletion and data corruption (the common case), not against loss
 *    of the deployment itself. Layer 1 (Convex's own managed backups) is what
 *    covers the latter.
 */

/** Daily backup copies to retain (retention window, NFR12). */
export const RETENTION_COPIES = 30;

/** Artifact envelope version. Bump if the on-disk shape changes. */
export const BACKUP_FORMAT = "fammycomforts.backup.v1";

/** Documents read per page. Keeps each query well under Convex's read limits. */
const PAGE_SIZE = 200;

/**
 * Hard ceiling on the artifact. Past this the run FAILS loudly rather than
 * writing a truncated copy: a backup you believe in but that silently omits
 * rows is worse than a visibly failed one. If this ever trips, the fix is to
 * move to a streaming/off-deployment export, not to raise the number.
 */
const MAX_EXPORT_BYTES = 64 * 1024 * 1024;

/** Runaway guard: 5000 pages × PAGE_SIZE = 1M documents per table. */
const MAX_PAGES_PER_TABLE = 5000;

/**
 * Every table to back up, derived from the schema itself rather than a
 * hand-maintained list — so a table added later is never silently left out of
 * the backup. Convex system tables (`_storage`, `_scheduled_functions`) are not
 * in `schema.tables` and are out of scope by design.
 */
export function backupTableNames(): string[] {
  return Object.keys(schema.tables).sort();
}

type ExportPage = {
  lines: string[];
  bytes: number;
  isDone: boolean;
  cursor: string;
};

/**
 * One page of one table, already encoded as JSON text.
 *
 * `convexToJson` is used (not bare `JSON.stringify`) because it round-trips
 * losslessly through `jsonToConvex` — critically for `v.int64()` money fields,
 * which plain `JSON.stringify` throws on outright.
 *
 * The encoded documents leave here as **strings**, not objects: that encoding
 * uses `$`-prefixed keys (`{"$integer": "…"}`), and `$` is not a legal Convex
 * field name, so returning them as values would be rejected at the query
 * boundary. Serializing inside the query sidesteps that entirely.
 */
export const exportPage = internalQuery({
  args: {
    table: v.string(),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  handler: async (ctx, { table, cursor, numItems }): Promise<ExportPage> => {
    const result = await ctx.db
      .query(table as TableNames)
      .paginate({ cursor, numItems });
    let bytes = 0;
    const lines = result.page.map((doc) => {
      const line = JSON.stringify(convexToJson(doc as unknown as Value));
      bytes += line.length;
      return line;
    });
    return {
      lines,
      bytes,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

/**
 * Produce the durable export artifact and persist it to Convex file storage.
 *
 * Walks every schema table page by page, assembles one JSON document, and
 * stores it. The envelope is built by string concatenation rather than
 * `JSON.stringify` on a big object, because the per-document text is already
 * encoded and must not be re-escaped.
 *
 * Shape:
 * ```json
 * {
 *   "format": "fammycomforts.backup.v1",
 *   "createdAt": "2026-08-25T21:00:00.000Z",
 *   "counts": { "bookings": 128, … },
 *   "tables": { "bookings": [ {…}, … ], … }
 * }
 * ```
 * Each document is `convexToJson` output, so `jsonToConvex` reconstructs the
 * exact original value including int64s and Ids. See BACKUP.md for restore.
 */
export async function runExport(
  ctx: ActionCtx,
): Promise<{ storageId: Id<"_storage">; sizeBytes: bigint }> {
  const counts: Record<string, number> = {};
  const sections: string[] = [];
  let approxBytes = 0;

  for (const table of backupTableNames()) {
    const lines: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    for (;;) {
      const page: ExportPage = await ctx.runQuery(internal.backups.exportPage, {
        table,
        cursor,
        numItems: PAGE_SIZE,
      });
      lines.push(...page.lines);
      approxBytes += page.bytes;

      if (approxBytes > MAX_EXPORT_BYTES) {
        throw new Error(
          `Backup aborted: export exceeded ${MAX_EXPORT_BYTES} bytes while reading "${table}". ` +
            "Move to a streaming/off-deployment export rather than raising the cap.",
        );
      }
      if (page.isDone) break;
      if (++pages >= MAX_PAGES_PER_TABLE) {
        throw new Error(
          `Backup aborted: "${table}" exceeded ${MAX_PAGES_PER_TABLE} pages without completing.`,
        );
      }
      cursor = page.cursor;
    }

    counts[table] = lines.length;
    sections.push(`${JSON.stringify(table)}:[${lines.join(",")}]`);
  }

  const text =
    `{"format":${JSON.stringify(BACKUP_FORMAT)},` +
    `"createdAt":${JSON.stringify(new Date().toISOString())},` +
    `"counts":${JSON.stringify(counts)},` +
    `"tables":{${sections.join(",")}}}`;

  const blob = new Blob([text], { type: "application/json" });
  const storageId = await ctx.storage.store(blob);
  return { storageId, sizeBytes: BigInt(blob.size) };
}


/**
 * Shared backup body. Opens a run, exports, finalizes, prunes. Re-throws after
 * recording a failure so the failure is visible in Convex's function logs (and
 * whatever exception reporting is wired there) rather than being swallowed.
 */
async function performBackup(
  ctx: ActionCtx,
  trigger: "cron" | "manual",
): Promise<void> {
  const runId = await ctx.runMutation(internal.backups.startRun, { trigger });
  try {
    const { storageId, sizeBytes } = await runExport(ctx);
    await ctx.runMutation(internal.backups.completeRun, {
      runId,
      storageId,
      sizeBytes,
    });
    // Enforce retention right after a successful copy (one cron, not two).
    await ctx.runMutation(internal.backups.prune, {});
  } catch (error) {
    await ctx.runMutation(internal.backups.failRun, {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Scheduled daily backup (00:00 EAT — see crons.ts). Idempotent, at-most-once. */
export const dailyExport = internalAction({
  args: {},
  handler: async (ctx) => {
    await performBackup(ctx, "cron");
  },
});

/**
 * On-demand backup, for the BACKUP.md restore drill and for taking a copy
 * before a risky migration:
 *
 *   npx convex run backups:exportNow
 *
 * Then `npx convex run backups:listRecent` to see the run and its `sizeBytes`.
 */
export const exportNow = internalAction({
  args: {},
  handler: async (ctx) => {
    await performBackup(ctx, "manual");
  },
});

/** Open a backup run (status `started`) + audit row, atomically. */
export const startRun = internalMutation({
  args: { trigger: v.union(v.literal("cron"), v.literal("manual")) },
  handler: async (ctx, { trigger }) => {
    const runId = await ctx.db.insert("backupRuns", {
      status: "started",
      startedAt: Date.now(),
      trigger,
    });
    await ctx.db.insert("auditLogs", {
      action: "backup.run",
      entityType: "backupRun",
      entityId: runId,
      after: { status: "started", trigger },
    });
    return runId;
  },
});

/** Mark a run completed with its stored artifact (idempotent on state). */
export const completeRun = internalMutation({
  args: {
    runId: v.id("backupRuns"),
    storageId: v.id("_storage"),
    sizeBytes: v.int64(),
  },
  handler: async (ctx, { runId, storageId, sizeBytes }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status !== "started") return; // already finalized — no-op
    await ctx.db.patch(runId, {
      status: "completed",
      finishedAt: Date.now(),
      storageId,
      sizeBytes,
    });
    await ctx.db.insert("auditLogs", {
      action: "backup.run",
      entityType: "backupRun",
      entityId: runId,
      before: { status: "started" },
      after: { status: "completed", sizeBytes: sizeBytes.toString() },
    });
  },
});

/** Mark a run failed (idempotent on state). */
export const failRun = internalMutation({
  args: { runId: v.id("backupRuns"), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.status !== "started") return;
    await ctx.db.patch(runId, { status: "failed", finishedAt: Date.now(), error });
    await ctx.db.insert("auditLogs", {
      action: "backup.run",
      entityType: "backupRun",
      entityId: runId,
      before: { status: "started" },
      after: { status: "failed", error },
    });
  },
});

/**
 * Enforce the retention window: keep the newest `RETENTION_COPIES` completed
 * runs, delete older ones — and delete the underlying blob in the same mutation
 * (deleting the row does NOT delete the blob — AR7′ orphan rule). Idempotent.
 */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const completed = (
      await ctx.db.query("backupRuns").withIndex("by_started").order("desc").collect()
    ).filter((r) => r.status === "completed");

    const stale = completed.slice(RETENTION_COPIES);
    for (const run of stale) {
      if (run.storageId) await ctx.storage.delete(run.storageId);
      await ctx.db.delete(run._id);
      await ctx.db.insert("auditLogs", {
        action: "backup.prune",
        entityType: "backupRun",
        entityId: run._id,
        before: { status: run.status, startedAt: run.startedAt },
      });
    }
    return stale.length;
  },
});

/**
 * Recent backup runs, newest-first (ops/health view). Ships as `internalQuery`;
 * TODO(Epic 2): promote to a `query` gated by `requirePermission(ctx, "settings",
 * "manage")` when the admin backup-status surface lands.
 */
export const listRecent = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("backupRuns")
      .withIndex("by_started")
      .order("desc")
      .take(limit ?? 20);
  },
});
