import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/guest" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Signed-in user (drives the foot block); identity.me via convex useQuery.
vi.mock("convex/react", () => ({
  useQuery: () => ({ name: "Grace Wanjiru", role: "admin", org: { name: "Demo" } }),
}));
// All permissions granted → every workspace link shows.
vi.mock("@/lib/use-permissions", () => ({
  usePermissions: () => ({ can: () => true, isLoading: false, perms: [] }),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    nav.pathname = "/guest";
  });

  it("renders a link for each staff workspace (admin = full access, no customer Book)", () => {
    render(<Sidebar />);
    for (const label of ["Admin", "Front Desk", "Operations", "Housekeeping", "Kitchen"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // The customer "Guest Booking" entry must NOT appear for staff/admin.
    expect(screen.queryByRole("link", { name: "Guest Booking" })).toBeNull();
  });

  it("shows the signed-in user's name + role and a sign-out control", () => {
    render(<Sidebar />);
    expect(screen.getByText("Grace Wanjiru")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument(); // admin → Administrator
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("marks the active workspace with aria-current=page from the pathname", () => {
    nav.pathname = "/front-desk";
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Front Desk" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Admin" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
