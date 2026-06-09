/**
 * Web-side permission helpers (Stories 2.3–2.5). Mirrors the backend catalog for
 * UI gating only — the server (`requirePermission`) is always authoritative.
 */

export const PERMISSION_AREAS = [
  "Dashboard",
  "Bookings",
  "Guests",
  "Rooms",
  "Calendar",
  "Housekeeping",
  "Maintenance",
  "Assets",
  "Inventory",
  "Purchases",
  "Restaurant",
  "Payments",
  "Reports",
  "Employees",
  "Roles",
  "Settings",
  "Notifications",
  "Audit logs",
] as const;
export type Area = (typeof PERMISSION_AREAS)[number];

export const ACTIONS = ["read", "write", "manage"] as const;
export type Action = (typeof ACTIONS)[number];

/** True if `perms` (an `area:action` list) grants `area:action`. */
export function hasPermission(
  perms: readonly string[],
  area: string,
  action: string,
): boolean {
  return perms.includes(`${area}:${action}`);
}
