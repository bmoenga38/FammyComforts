/**
 * RBAC catalog (Story 2.3) — the 18 permission areas × 3 actions, and the 12
 * base roles with their default grants (PRD §7). Single source of truth shared
 * by the seed (`rbac.ts`), the enforcement helper (`requirePermission`), and the
 * web permission gate, so areas/actions are typed, not stringly-typed.
 *
 * `manage` is a DISCRETE grant — there is no implicit `manage ⇒ write ⇒ read`.
 * Default grants below enumerate every action a role gets explicitly.
 */

export const ACTIONS = ["read", "write", "manage"] as const;
export type Action = (typeof ACTIONS)[number];

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

export type Grant = { area: Area; action: Action };

/** Grant `action` on every area (e.g. full read across the app). */
const everyArea = (action: Action): Grant[] =>
  PERMISSION_AREAS.map((area) => ({ area, action }));

/** Expand `[area, actions[]]` rows into explicit grants. */
const grants = (rows: [Area, Action[]][]): Grant[] =>
  rows.flatMap(([area, actions]) => actions.map((action) => ({ area, action })));

// Full control: every area at every action (read+write+manage), enumerated.
const FULL: Grant[] = ACTIONS.flatMap(everyArea);

export type BaseRole = {
  name: string;
  description: string;
  grants: Grant[];
};

/**
 * The 12 base roles (PRD §7) seeded per-org. Default grants are sensible
 * starting points an admin can customise via `roles.setPermission`.
 */
export const BASE_ROLES: BaseRole[] = [
  { name: "Super Admin", description: "Full platform control.", grants: FULL },
  { name: "Property Admin", description: "Full property control.", grants: FULL },
  {
    name: "Operations Manager",
    description: "Runs daily operations across the property.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Bookings", ["read", "write", "manage"]],
      ["Guests", ["read", "write", "manage"]],
      ["Rooms", ["read", "write", "manage"]],
      ["Calendar", ["read", "write", "manage"]],
      ["Housekeeping", ["read", "write", "manage"]],
      ["Maintenance", ["read", "write", "manage"]],
      ["Assets", ["read", "write", "manage"]],
      ["Inventory", ["read"]],
      ["Purchases", ["read"]],
      ["Restaurant", ["read"]],
      ["Payments", ["read"]],
      ["Reports", ["read"]],
      ["Notifications", ["read"]],
    ]),
  },
  {
    name: "Receptionist",
    description: "Front desk: bookings, guests, payments.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Bookings", ["read", "write"]],
      ["Guests", ["read", "write"]],
      ["Rooms", ["read"]],
      ["Calendar", ["read", "write"]],
      ["Payments", ["read", "write"]],
      ["Notifications", ["read"]],
    ]),
  },
  {
    name: "Housekeeping",
    description: "Room cleaning tasks.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Housekeeping", ["read", "write"]],
      ["Rooms", ["read"]],
      ["Assets", ["read"]],
    ]),
  },
  {
    name: "Caretaker / Assistant",
    description: "Housekeeping + light maintenance/asset duties.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Housekeeping", ["read", "write"]],
      ["Maintenance", ["read", "write"]],
      ["Assets", ["read", "write"]],
    ]),
  },
  {
    name: "Maintenance",
    description: "Maintenance and damage handling.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Maintenance", ["read", "write"]],
      ["Assets", ["read", "write"]],
    ]),
  },
  {
    name: "Restaurant Manager",
    description: "Runs the restaurant/kitchen.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Restaurant", ["read", "write", "manage"]],
      ["Inventory", ["read"]],
      ["Payments", ["read"]],
      ["Reports", ["read"]],
    ]),
  },
  {
    name: "Waiter",
    description: "Takes and serves restaurant orders.",
    grants: grants([["Restaurant", ["read", "write"]]]),
  },
  {
    name: "Chef / Kitchen",
    description: "Prepares restaurant orders.",
    grants: grants([["Restaurant", ["read", "write"]]]),
  },
  {
    name: "Accountant",
    description: "Payments, invoicing, and reports.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Bookings", ["read"]],
      ["Payments", ["read", "write", "manage"]],
      ["Reports", ["read", "write", "manage"]],
    ]),
  },
  {
    name: "Security",
    description: "Asset checks and audit visibility.",
    grants: grants([
      ["Dashboard", ["read"]],
      ["Assets", ["read"]],
      ["Audit logs", ["read"]],
    ]),
  },
];
