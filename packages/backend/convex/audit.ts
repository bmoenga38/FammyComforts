import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id, TableNames } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import {
  ENTITY_TABLES,
  describeChanges,
  documentLabel,
  entityPhrase,
  humanizeAction,
  humanizeToken,
  shortId,
  type FieldChange,
} from "./lib/auditFormat";

/**
 * Audit log view (Story 2.5) — org-scoped, gated by `Audit logs:read`. Audit
 * rows are *written* throughout (auth, roles, staff, …); this is the read/filter
 * surface. Only the caller's org's rows are returned (the `by_org` index excludes
 * infra rows that carry no `orgId`, e.g. backups). Newest first.
 *
 * ── WHY THE LABELS ARE RESOLVED HERE ─────────────────────────────────────────
 * A row stores ids, not names: `{ action: "room.update", entityType: "room",
 * entityId: "n97drrth…", actorId: "ks7c4ac8…" }`. Rendered literally that is
 * unauditable, so this query joins each row to its subject document and to the
 * acting user and returns ready-to-read strings.
 *
 * Resolving at READ time (rather than only trusting a snapshot taken at write
 * time) is a deliberate trade-off:
 *  + every one of the ~85 existing write sites and all historical rows become
 *    readable immediately, with no migration and no backfill;
 *  + a renamed room shows its CURRENT name, which is what an admin chasing "who
 *    touched room 101" actually wants;
 *  − history is therefore not immutable: rename room 203 to 101 and older rows
 *    say 101 too.
 *
 * That last point is why `auditLogs.entityLabel` / `.actorLabel` exist in the
 * schema: when a write site wants a frozen name (a deletion, a staff offboarding
 * — cases where the document will be GONE), it snapshots one, and the snapshot
 * WINS here. So write sites can adopt immutability one at a time without another
 * schema change or any UI change. Deleted documents with no snapshot fall back to
 * the short id, never to a blank cell.
 *
 * Cost: at most one extra read per distinct actor and per distinct entity in the
 * page (both memoized below), so a 100-row page is a few hundred point reads —
 * far inside Convex's per-query read limit.
 */

export type AuditRow = {
  _id: Id<"auditLogs">;
  _creationTime: number;
  /** Kept so callers can still assert tenant scoping on the returned rows. */
  orgId?: Id<"organizations">;
  /** Machine action, kept for filtering: `"room.update"`. */
  action: string;
  /** Readable action: `"Room updated"`. */
  actionLabel: string;
  entityType: string;
  /** Readable entity noun: `"Room type"`. */
  entityTypeLabel: string;
  /**
   * Raw ids, still returned purely so a deploy is order-independent: the
   * previously-shipped UI read `entityId`/`actorId` directly, and Convex functions
   * go live before Vercel finishes building the new frontend. Render `entity` and
   * `actor` instead — these two are for compatibility, not for display.
   */
  entityId?: string;
  actorId?: string;
  /** Full readable phrase: `Room "101"`, or `Room (deleted · n97drrth…)`. */
  entity: string;
  /** Readable actor: a staff name, or `"System"` for unattributed infra rows. */
  actor: string;
  /** Field-level diff, already formatted (money via `formatKesCents`). */
  changes: FieldChange[];
  ip?: string;
};

/** Memoized `entityId` → label. `null` means "looked up, nothing to show". */
async function resolveEntityLabel(
  ctx: QueryCtx,
  cache: Map<string, string | null>,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  const key = `${entityType}:${entityId}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let label: string | null = null;
  const table = ENTITY_TABLES[entityType];
  if (table) {
    // `normalizeId` is the only safe way in: `db.get` throws on a string that is
    // not a well-formed id, and audit `entityId` is a plain `v.string()` that
    // may predate a table rename or hold something hand-written.
    const id = ctx.db.normalizeId(table as TableNames, entityId);
    if (id) {
      const doc = await ctx.db.get(id);
      label = documentLabel(doc as unknown as Record<string, unknown> | null);
    }
  }
  cache.set(key, label);
  return label;
}

/** Memoized `actorId` → staff name, falling back to the short id then `"System"`. */
async function resolveActor(
  ctx: QueryCtx,
  cache: Map<string, string>,
  actorId: string | undefined,
): Promise<string> {
  if (!actorId) return "System";
  const hit = cache.get(actorId);
  if (hit !== undefined) return hit;

  let label = `Deleted user (${shortId(actorId)})`;
  const id = ctx.db.normalizeId("users", actorId);
  if (id) {
    const user = await ctx.db.get(id);
    if (user?.name?.trim()) label = user.name.trim();
    else if (user?.phone) label = user.phone;
  }
  cache.set(actorId, label);
  return label;
}

export const list = query({
  args: {
    limit: v.optional(v.number()),
    // Optional filters: `action` is a prefix match (e.g. "staff." or "role.");
    // `entityType` is exact (e.g. "user", "role").
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
  },
  handler: async (ctx, { limit, action, entityType }): Promise<AuditRow[]> => {
    const { orgId } = await requirePermission(ctx, "Audit logs", "read");
    const capped = Math.min(Math.max(limit ?? 100, 1), 500);

    let rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(capped);

    if (action) rows = rows.filter((r) => r.action.startsWith(action));
    if (entityType) rows = rows.filter((r) => r.entityType === entityType);

    const entityCache = new Map<string, string | null>();
    const actorCache = new Map<string, string>();

    const out: AuditRow[] = [];
    for (const r of rows) {
      // A snapshot taken at write time always wins — see the header note.
      const label =
        r.entityLabel ??
        (r.entityId
          ? await resolveEntityLabel(ctx, entityCache, r.entityType, r.entityId)
          : null);

      out.push({
        _id: r._id,
        _creationTime: r._creationTime,
        orgId: r.orgId,
        action: r.action,
        actionLabel: humanizeAction(r.action),
        entityType: r.entityType,
        entityTypeLabel: humanizeToken(r.entityType) || r.entityType,
        entityId: r.entityId,
        actorId: r.actorId,
        entity: entityPhrase(r.entityType, label, r.entityId),
        actor: r.actorLabel ?? (await resolveActor(ctx, actorCache, r.actorId)),
        changes: describeChanges(r.before, r.after),
        ...(r.ip ? { ip: r.ip } : {}),
      });
    }
    return out;
  },
});

/**
 * Distinct `entityType`s present in this org's log, for the filter dropdown.
 * Derived from the rows themselves so it never offers an empty filter.
 */
export const entityTypes = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Audit logs", "read");
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(500);
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (!seen.has(r.entityType)) {
        seen.set(r.entityType, humanizeToken(r.entityType) || r.entityType);
      }
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((x, y) => x.label.localeCompare(y.label));
  },
});
