import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { jsonToConvex, type JSONValue } from "convex/values";
import schema from "./schema";
import { internal } from "./_generated/api";
import { RETENTION_COPIES, BACKUP_FORMAT, backupTableNames } from "./backups";

/**
 * Backup-run lifecycle, export and retention tests (Story 1.10, AC7).
 *
 * Covers the whole path now that `runExport` is implemented: the deterministic
 * mutation/query layer plus an end-to-end `dailyExport` that writes a real
 * artifact into (test-harness) file storage and reads it back.
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

  it("backupTableNames is derived from the schema, so new tables are covered automatically", () => {
    const names = backupTableNames();
    expect(names.length).toBeGreaterThan(20);
    expect(names).toContain("organizations");
    expect(names).toContain("bookings");
    expect(names).toContain("auditLogs");
    expect(names).toContain("outboundNotifications");
    // Sorted, so the artifact's table order is stable between runs.
    expect([...names].sort()).toEqual(names);
    // Convex system tables are not ours to export.
    expect(names.some((n) => n.startsWith("_"))).toBe(false);
  });

  it("dailyExport writes a restorable artifact covering every schema table", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));

    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        bytebazaarOrgId: "bb-org-1",
        name: "Fammy Comforts",
        slug: "fammy-comforts",
      });
      // Seeded with an int64: money is stored in minor units, and plain
      // JSON.stringify throws on BigInt — this proves the encoding survives.
      await ctx.db.insert("backupRuns", {
        status: "completed",
        startedAt: 1,
        finishedAt: 2,
        sizeBytes: 4096n,
        trigger: "manual",
      });
    });

    await t.action(internal.backups.dailyExport, {});

    const run = await t.run(async (ctx) => {
      const runs = await ctx.db.query("backupRuns").collect();
      return runs.find((r) => r.trigger === "cron");
    });
    expect(run?.status).toBe("completed");
    expect(run?.storageId).toBeTruthy();
    expect(run?.sizeBytes ?? 0n).toBeGreaterThan(0n);

    const text = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(run!.storageId!);
      return await blob!.text();
    });

    const artifact = JSON.parse(text) as {
      format: string;
      createdAt: string;
      counts: Record<string, number>;
      tables: Record<string, JSONValue[]>;
    };
    expect(artifact.format).toBe(BACKUP_FORMAT);
    expect(Date.parse(artifact.createdAt)).not.toBeNaN();
    // Every schema table present, even the empty ones — an absent key would be
    // indistinguishable from a table that failed to export.
    expect(Object.keys(artifact.tables).sort()).toEqual(backupTableNames());
    expect(artifact.counts.organizations).toBe(1);

    const org = jsonToConvex(artifact.tables.organizations[0]) as {
      slug: string;
      name: string;
    };
    expect(org.slug).toBe("fammy-comforts");
    expect(org.name).toBe("Fammy Comforts");

    // The int64 round-trips back to an exact BigInt, not a lossy number.
    const seeded = artifact.tables.backupRuns
      .map((d) => jsonToConvex(d) as { trigger: string; sizeBytes?: bigint })
      .find((d) => d.trigger === "manual");
    expect(seeded?.sizeBytes).toBe(4096n);
  });

  it("a failed export leaves a failed run, not a phantom success", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));

    // The failure path matters as much as the happy one: a run that failed must
    // never carry a storageId/sizeBytes, or the ledger would claim a copy that
    // does not exist and `prune` would count it toward retention.
    const runId = await t.mutation(internal.backups.startRun, { trigger: "cron" });
    await t.mutation(internal.backups.failRun, { runId, error: "boom" });

    const runs = await t.run((ctx) => ctx.db.query("backupRuns").collect());
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("failed");
    expect(runs[0].storageId).toBeUndefined();
    expect(runs[0].sizeBytes).toBeUndefined();
  });
});
