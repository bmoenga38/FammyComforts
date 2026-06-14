/**
 * Canonical, human-friendly labels for the raw role strings that ride on a
 * user record. Roles arrive from several sources — the demo seed
 * (admin/reception/operations/assistant/customer), the SSO handoff
 * (super_admin/org_admin/manager/…), and the RBAC base roles — so this map is
 * the single place that normalizes them for display. Use `roleLabel()`
 * everywhere a role is shown to a person, so "ops", "operations", and
 * "ops_manager" all read as "Operations Manager".
 */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Administrator",
  admin: "Administrator",
  property_admin: "Property Admin",
  manager: "Operations Manager",
  ops_manager: "Operations Manager",
  operations: "Operations Manager",
  reception: "Front Desk",
  receptionist: "Front Desk",
  assistant: "Housekeeping",
  housekeeper: "Housekeeping",
  housekeeping: "Housekeeping",
  caretaker: "Caretaker",
  maintenance: "Maintenance",
  restaurant_manager: "Restaurant Manager",
  waiter: "Waiter",
  chef: "Chef / Kitchen",
  kitchen: "Chef / Kitchen",
  finance: "Accountant",
  accountant: "Accountant",
  security: "Security",
  customer: "Customer",
};

/** Friendly display label for any role string (title-cases unknown values). */
export function roleLabel(role?: string | null): string {
  if (!role) return "Member";
  const key = role.toLowerCase();
  return (
    ROLE_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Up-to-two-letter initials from a name, for the sidebar avatar. */
export function initialsOf(name?: string | null): string {
  if (!name) return "·";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
