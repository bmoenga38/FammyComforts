import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Backup / disaster-recovery baseline (Story 1.10, NFR12). The backend is Convex,
 * so recoverability rests on: (1) Convex's managed snapshots + point-in-time
 * history on the deployment, (2) this app-owned scheduled `convex export` that
 * keeps an independent durable artifact, and (3) the restore runbook (BACKUP.md).
 *
 * Durability rule (Convex Implementation Guide → Scheduler & Crons): scheduled
 * MUTATIONS run exactly-once (auto-retried); scheduled ACTIONS run at-most-once.
 * So `dailyExport` is an `internalAction` (it does export/storage work) and keeps
 * ALL database writes in `internalMutation`s via `ctx.runMutation`, and is
 * idempotent (state-guarded).
 */

/** Daily backup copies to retain (retention window, NFR12). */
export const RETENTION_COPIES = 30;

/**
 * Seam for producing the durable export artifact. TODO(convex dev): wire the real
 * deployment export here — generate the export bytes and persist them with
 * `ctx.storage.store(blob)`, returning the `_storage` id + size. Until that runs
 * against the authed deployment this throws, so an offline/unwired cron run is
 * recorded as `failed` rather than silently "succeeding" with no data. Tests stub
 * this export (it is the single external side-effect).
 */
export async function runExport(
  _ctx: ActionCtx,
): Promise<{ storageId: Id<"_storage">; sizeBytes: bigint }> {
  throw new Error(
    "backup export not wired — run `npx convex dev` and implement runExport() (deferred)",
  );
}

/** Scheduled daily backup (00:00 EAT — see crons.ts). Idempotent, at-most-once. */
export const dailyExport = internalAction({
  args: {},
  handler: async (ctx) => {
    const runId = await ctx.runMutation(internal.backups.startRun, {
      trigger: "cron" as const,
    });
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
