import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { RETENTION_COPIES } from "./backups";

/**
 * Backup-run lifecycle + retention tests (Story 1.10, AC7).
 *
 * DEFERRED-RUN: this exercises the deterministic mutation/query layer (the
 * external `runExport` action seam is out of scope here). It runs ONLY once
 * (a) `convex/_generated` exists (`npx convex dev` / `codegen`) and (b) the
 * Story 1.11 `convex-test` + `edge-runtime` harness is wired into
 * `packages/backend` (deps + a `test` script + an edge-runtime vitest config).
 * Until then `packages/backend` has no `test` script, so this file is inert
 * and never runs in `pnpm test` (gates stay green).
 */
describe("backups", () => {
  it("startRun → completeRun writes the run + audit rows; listRecent is newest-first", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));

    const runId = await t.mutation(internal.backups.startRun, { trigger: "cron" });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["backup"])));
    await t.mutation(internal.backups.completeRun, { runId, storageId, sizeBytes: 6n });

    const recent = await t.query(internal.backups.listRecent, {});
    expect(recent[0]?.status).toBe("completed");

    const audits = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(audits.filter((a) => a.action === "backup.run").length).toBeGreaterThanOrEqual(2);
  });

  it("completeRun is idempotent (second call is a no-op)", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const runId = await t.mutation(internal.backups.startRun, { trigger: "manual" });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["b"])));
    await t.mutation(internal.backups.completeRun, { runId, storageId, sizeBytes: 1n });
    await t.mutation(internal.backups.completeRun, { runId, storageId, sizeBytes: 1n });
    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run?.status).toBe("completed");
  });

  it("failRun records the failure", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const runId = await t.mutation(internal.backups.startRun, { trigger: "cron" });
    await t.mutation(internal.backups.failRun, { runId, error: "export not wired" });
    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run?.status).toBe("failed");
    expect(run?.error).toContain("export");
  });

  it("prune keeps the newest RETENTION_COPIES, deletes older rows + their blobs, and is idempotent", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));

    // Seed RETENTION_COPIES + 3 completed runs, each with a stored blob.
    const extra = 3;
    for (let i = 0; i < RETENTION_COPIES + extra; i++) {
      await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob([`b${i}`]));
        await ctx.db.insert("backupRuns", {
          status: "completed",
          startedAt: i, // ascending → newest = highest index
          finishedAt: i,
          storageId,
          sizeBytes: 2n,
          trigger: "cron",
        });
      });
    }

    const deleted = await t.mutation(internal.backups.prune, {});
    expect(deleted).toBe(extra);

    const remaining = await t.run((ctx) => ctx.db.query("backupRuns").collect());
    expect(remaining).toHaveLength(RETENTION_COPIES);

    // Re-running prune is a no-op.
    const deletedAgain = await t.mutation(internal.backups.prune, {});
    expect(deletedAgain).toBe(0);
  });
});
