#!/usr/bin/env node
/**
 * Split a `fammycomforts.backup.v1` artifact into per-table JSONL files ready
 * for `npx convex import`.
 *
 * The daily backup (convex/backups.ts) writes ONE JSON document containing every
 * table. `convex import` wants one file per table, so this unpacks it.
 *
 * Usage:
 *   node scripts/split-backup.mjs <backup.json> [outDir]
 *
 * Then, per table (see convex/BACKUP.md — run against a SCRATCH deployment):
 *   npx convex import --table <name> --replace <outDir>/<name>.jsonl
 *
 * Documents are stored in Convex's own JSON encoding (`convexToJson`), which is
 * what preserves int64 money values and Ids. Fields are emitted as-is; `_id` and
 * `_creationTime` are kept in a `.meta.jsonl` sidecar per table rather than in
 * the import file, because `convex import --table` assigns fresh ones.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const [, , inputPath, outDirArg] = process.argv;

if (!inputPath) {
  console.error("usage: node scripts/split-backup.mjs <backup.json> [outDir]");
  process.exit(1);
}

const outDir = resolve(outDirArg ?? "backup-split");
const artifact = JSON.parse(readFileSync(resolve(inputPath), "utf8"));

if (artifact.format !== "fammycomforts.backup.v1") {
  console.error(
    `Unexpected format ${JSON.stringify(artifact.format)} — expected fammycomforts.backup.v1.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const tableNames = Object.keys(artifact.tables).sort();
let totalDocs = 0;
const empty = [];

for (const table of tableNames) {
  const docs = artifact.tables[table] ?? [];
  if (docs.length === 0) {
    empty.push(table);
    continue;
  }

  const rows = [];
  const meta = [];
  for (const doc of docs) {
    const { _id, _creationTime, ...fields } = doc;
    rows.push(JSON.stringify(fields));
    meta.push(JSON.stringify({ _id, _creationTime }));
  }

  writeFileSync(join(outDir, `${table}.jsonl`), `${rows.join("\n")}\n`);
  writeFileSync(join(outDir, `${table}.meta.jsonl`), `${meta.join("\n")}\n`);
  totalDocs += rows.length;
  console.log(`${table.padEnd(32)} ${String(rows.length).padStart(7)} docs`);
}

console.log(`\ncreated at : ${artifact.createdAt}`);
console.log(`tables     : ${tableNames.length} (${empty.length} empty, skipped)`);
console.log(`documents  : ${totalDocs}`);
console.log(`output     : ${outDir}`);

// Cross-check against the counts the exporter recorded, so a truncated or
// hand-edited artifact is caught here rather than halfway through a restore.
const mismatches = tableNames.filter(
  (t) => (artifact.counts?.[t] ?? 0) !== (artifact.tables[t]?.length ?? 0),
);
if (mismatches.length > 0) {
  console.error(
    `\n⚠️  count mismatch in: ${mismatches.join(", ")} — artifact may be incomplete.`,
  );
  process.exit(2);
}
console.log("\ncounts match the exporter's ledger. ✓");
console.log(
  "\nReferential integrity warning: `convex import --table` assigns NEW _ids, so\n" +
    "v.id() foreign keys across tables will not match. For a full-fidelity restore\n" +
    "prefer Convex's own snapshot/PITR restore (layer 1). See convex/BACKUP.md §Restore.",
);
