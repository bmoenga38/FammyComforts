import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/guest" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
// Staff session → bottom nav uses the workspace set this test asserts.
vi.mock("convex/react", () => ({ useQuery: () => ({ role: "admin" }) }));
vi.mock("@/lib/use-permissions", () => ({
  usePermissions: () => ({ can: () => true, isLoading: false, perms: [] }),
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

import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  beforeEach(() => {
    nav.pathname = "/guest";
  });

  it("renders the primary staff workspaces (operations + customer Book excluded)", () => {
    render(<BottomNav />);
    for (const label of ["Admin", "Desk", "Clean", "Kitchen"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "Ops" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Book" })).toBeNull();
  });

  it("marks the active workspace with aria-current=page from the pathname", () => {
    nav.pathname = "/housekeeping";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Clean" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Admin" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
