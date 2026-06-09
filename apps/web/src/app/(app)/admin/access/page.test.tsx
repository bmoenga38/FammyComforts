import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Access admin gating (Stories 2.3–2.5): the page must only surface sections the
 * caller's permissions allow, and show "No access" when they have none. The
 * server enforces too; this guards the UI layer.
 */
let perms: string[] | undefined;

vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: {
    roles: {
      myPermissions: "roles.myPermissions",
      list: "roles.list",
      getWithPermissions: "roles.getWithPermissions",
      setPermission: "roles.setPermission",
    },
    staff: { list: "staff.list", setActive: "staff.setActive" },
    audit: { list: "audit.list" },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: string) => (ref === "roles.myPermissions" ? perms : []),
  useMutation: () => vi.fn(),
}));

import AccessAdminPage from "./page";

beforeEach(() => {
  perms = [];
});

describe("AccessAdminPage gating", () => {
  it("shows 'No access' when the user has no relevant permissions", () => {
    perms = ["Bookings:write"]; // nothing for Roles/Employees/Audit
    render(<AccessAdminPage />);
    expect(screen.getByText(/no access/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /roles/i })).toBeNull();
  });

  it("shows only the Roles tab for a Roles-only permission", () => {
    perms = ["Roles:manage"];
    render(<AccessAdminPage />);
    expect(screen.getByRole("tab", { name: /roles/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /staff/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /audit log/i })).toBeNull();
  });

  it("shows Staff and Audit tabs when permitted", () => {
    perms = ["Employees:read", "Audit logs:read"];
    render(<AccessAdminPage />);
    expect(screen.getByRole("tab", { name: /staff/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /audit log/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^roles$/i })).toBeNull();
  });

  it("renders a loading state until permissions resolve", () => {
    perms = undefined;
    render(<AccessAdminPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
