import { formatKesCents } from "./money";

/**
 * Human-readable rendering of audit-log rows (Story 2.5 readability).
 *
 * The admin audit table used to print the raw row, so it read:
 *
 *     roomType.create    roomType · n572z146…    ks7c4ac8
 *
 * Three unreadable columns: a dotted machine action, a table name plus a
 * truncated document id, and a truncated user id. Nobody can audit anything from
 * that. These helpers turn it into:
 *
 *     Room type created  Room type "Closed Balcony"  Grace Achieng
 *
 * Everything here is PURE — no `ctx`, no `fetch`, no clock — per the `lib/`
 * convention, so it is unit-testable and safe to call from a query. The document
 * lookups that produce the raw label live in `convex/audit.ts`.
 */

/** `"roomType"` → `"Room type"`; `"check_in"` → `"Check in"`. */
export function humanizeToken(token: string): string {
  const spaced = token
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!spaced) return "";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Past-tense phrases for the action verbs actually written by this codebase.
 *
 * Anything missing falls back to `humanizeToken`, so a new action added later
 * degrades to "Restaurant stock short" rather than breaking the page — readable,
 * just not conjugated. Add the verb here when you add the action.
 */
const VERB_PHRASES: Record<string, string> = {
  add: "added",
  assign: "assigned",
  assign_role: "role assigned",
  attach_photo: "photo attached",
  callback_unmatched: "callback did not match a booking",
  cancel: "cancelled",
  cancel_po: "purchase order cancelled",
  change_room: "moved to another room",
  charge_to_room: "charged to a room",
  check_in: "checked in",
  check_out: "checked out",
  config_saved: "settings saved",
  confirm: "confirmed",
  confirmed: "confirmed",
  create: "created",
  create_menu_item: "menu item created",
  create_order: "order created",
  create_po: "purchase order created",
  create_product: "product created",
  create_supplier: "supplier created",
  delete: "deleted",
  extend: "extended",
  failed: "failed",
  guest_order: "ordered by a guest",
  no_show: "marked as a no-show",
  pay_order: "order paid",
  permission_change: "permissions changed",
  prune: "pruned",
  receive_po: "purchase order received",
  reconcile: "reconciled",
  record_manual: "recorded manually",
  register: "registered",
  remove: "removed",
  remove_role: "role removed",
  report: "reported",
  resolve: "resolved",
  run: "ran",
  refund: "refunded",
  save_template: "template saved",
  seed: "seeded",
  set_active: "activated / deactivated",
  set_enabled: "enabled / disabled",
  set_status: "status changed",
  set_template: "template set",
  stk_initiated: "M-Pesa prompt sent",
  stock_short: "ran short of stock",
  stocktake: "stock counted",
  submit: "submitted",
  update: "updated",
  update_notes: "notes updated",
  update_profile: "profile updated",
  verify_checkout: "verified at checkout",
};

/** `"room.update"` → `"Room updated"`; `"booking.check_in"` → `"Booking checked in"`. */
export function humanizeAction(action: string): string {
  const dot = action.indexOf(".");
  if (dot < 0) return humanizeToken(action);
  const subject = humanizeToken(action.slice(0, dot));
  const verb = action.slice(dot + 1);
  if (!verb) return subject;
  const phrase = VERB_PHRASES[verb] ?? humanizeToken(verb).toLowerCase();
  return `${subject} ${phrase}`.trim();
}

/**
 * `entityType` (as written into the row) → the table holding that document.
 *
 * Explicit rather than pluralized, because English plurals lie: `amenity` →
 * `amenities`, `property` → `properties`. Every value below was checked against
 * `schema.ts`. An unmapped type resolves to no label and the UI falls back to the
 * short id, which is the pre-existing behaviour — never an error.
 */
export const ENTITY_TABLES: Record<string, string> = {
  amenity: "amenities",
  backupRun: "backupRuns",
  booking: "bookings",
  branch: "branches",
  checklistTemplate: "checklistTemplates",
  escalation: "escalations",
  guest: "guests",
  guestRequest: "guestRequests",
  housekeepingTask: "housekeepingTasks",
  invoice: "invoices",
  maintenanceIssue: "maintenanceIssues",
  menuItem: "menuItems",
  mpesaConfig: "mpesaConfigs",
  notificationSetting: "notificationSettings",
  notificationTemplate: "notificationTemplates",
  order: "orders",
  organization: "organizations",
  payment: "payments",
  paymentMethodSetting: "paymentMethodSettings",
  product: "products",
  property: "properties",
  purchaseOrder: "purchaseOrders",
  ratePlan: "ratePlans",
  role: "roles",
  room: "rooms",
  roomAsset: "roomAssets",
  roomType: "roomTypes",
  supplier: "suppliers",
  taxRule: "taxRules",
  user: "users",
};

/**
 * Fields tried in order when naming a fetched document.
 *
 * One ordered list instead of a per-table switch: every tenant table names its
 * subject with one of these, so adding a table needs no change here. `name` wins
 * over `description` so a supplier reads as its name, not its address.
 */
const LABEL_FIELDS = [
  "name",
  "fullName",
  "reference",
  "number",
  "title",
  "trigger",
  "method",
  "type",
  "message",
  "description",
  "shortcode",
  "status",
] as const;

/** Longest label kept before ellipsis — a 1000-char guest request must not blow up the row. */
const MAX_LABEL = 48;

function clamp(text: string, max = MAX_LABEL): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Pick a display label out of an already-fetched document, or `null` if none fits. */
export function documentLabel(doc: Record<string, unknown> | null): string | null {
  if (!doc) return null;
  for (const field of LABEL_FIELDS) {
    const value = doc[field];
    if (typeof value === "string" && value.trim()) return clamp(value);
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** `"n97drrth7q2…"` — the last-resort reference when a document is gone. */
export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

/**
 * Never-empty entity phrase: `Room "101"`, or `Room (deleted · n97drrth…)`.
 *
 * The deleted case is why the label cannot simply be resolved and forgotten — a
 * row whose subject has since been deleted still has to identify *something*, so
 * the raw id survives as the fallback rather than the cell going blank.
 */
export function entityPhrase(
  entityType: string,
  label: string | null,
  entityId: string | undefined,
): string {
  const noun = humanizeToken(entityType) || entityType;
  if (label) return `${noun} "${label}"`;
  if (entityId) return `${noun} (deleted · ${shortId(entityId)})`;
  return noun;
}

/** True for field names holding integer minor units, by the repo's `…Cents` convention. */
function isMoneyField(field: string): boolean {
  return /Cents$/.test(field);
}

/** Fields never worth showing in a diff — ids and scoping, not decisions. */
const NOISE_FIELDS = new Set([
  "orgId",
  "actorId",
  "_id",
  "_creationTime",
  "updatedAt",
  "createdAt",
]);

/** One rendered field change. `from`/`to` are pre-formatted strings — no BigInt crosses the wire. */
export type FieldChange = { field: string; from: string | null; to: string | null };

/**
 * Render one value for a diff cell.
 *
 * BigInts are formatted as money when the field name says so (`…Cents`), and are
 * stringified rather than passed through otherwise — a raw `bigint` in a query
 * result is legal Convex but a landmine in the browser (`JSON.stringify` throws
 * on it).
 */
function renderValue(field: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") {
    return isMoneyField(field) ? formatKesCents(value) : value.toString();
  }
  if (typeof value === "number" && isMoneyField(field)) {
    return formatKesCents(BigInt(Math.round(value)));
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") return clamp(value, 80);
  if (Array.isArray(value)) return value.length === 1 ? "1 item" : `${value.length} items`;
  if (typeof value === "object") return clamp(JSON.stringify(value), 80);
  return clamp(String(value), 80);
}

/**
 * Field-level diff of an audit row's `before`/`after` payloads.
 *
 * Only fields that actually differ are returned, so "Room updated" shows
 * `Number: 203 → 101` rather than every column the patch happened to carry.
 * Rows with only an `after` (a creation) list what it was created with.
 */
export function describeChanges(before: unknown, after: unknown): FieldChange[] {
  const b = (before && typeof before === "object" && !Array.isArray(before)
    ? before
    : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" && !Array.isArray(after)
    ? after
    : {}) as Record<string, unknown>;

  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .filter((f) => !NOISE_FIELDS.has(f))
    .sort();

  const changes: FieldChange[] = [];
  for (const field of fields) {
    const from = renderValue(field, b[field]);
    const to = renderValue(field, a[field]);
    if (from === to) continue;
    changes.push({ field: humanizeToken(field.replace(/Cents$/, "")), from, to });
  }
  return changes;
}
