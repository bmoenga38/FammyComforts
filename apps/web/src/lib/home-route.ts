/**
 * Where each role lands after sign-in (and where `/` sends an authed user).
 * Keeps the raw role strings from the demo seed and the SSO handoff in one
 * place so admins reach /admin, reception the desk, customers their home, etc.
 * Unknown roles fall back to the customer home.
 */
const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  org_admin: "/admin",
  super_admin: "/admin",
  property_admin: "/admin",
  accountant: "/admin",
  finance: "/admin",
  security: "/admin",
  reception: "/front-desk",
  receptionist: "/front-desk",
  operations: "/operations",
  manager: "/operations",
  ops_manager: "/operations",
  assistant: "/housekeeping",
  housekeeper: "/housekeeping",
  housekeeping: "/housekeeping",
  caretaker: "/housekeeping",
  maintenance: "/housekeeping",
  chef: "/kitchen",
  kitchen: "/kitchen",
  waiter: "/kitchen",
  restaurant_manager: "/kitchen",
  customer: "/guest",
};

/** Landing route for a role; customers + unknowns go to the customer home. */
export function homeForRole(role?: string | null): string {
  return ROLE_HOME[(role ?? "").toLowerCase()] ?? "/guest";
}

/** True for the customer role (drives the customer vs staff nav set). */
export function isCustomerRole(role?: string | null): boolean {
  return (role ?? "").toLowerCase() === "customer";
}

/**
 * True for an admin/owner role. Admins are superusers — the UI shows them the
 * FULL workspace nav regardless of granular RBAC rows (god mode), so the nav is
 * never empty for an admin even if permission seeding is incomplete.
 */
export function isAdminRole(role?: string | null): boolean {
  return ["admin", "org_admin", "super_admin", "property_admin"].includes(
    (role ?? "").toLowerCase(),
  );
}
