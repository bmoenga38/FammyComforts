import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/guest" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
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

import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    nav.pathname = "/guest";
  });

  it("renders a link for each of the six workspaces", () => {
    render(<Sidebar />);
    for (const label of [
      "Guest Booking",
      "Admin",
      "Front Desk",
      "Operations",
      "Housekeeping",
      "Kitchen",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
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
