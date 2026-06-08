import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/front-desk" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { TopBar } from "./top-bar";

describe("TopBar", () => {
  it("shows the active workspace title as the page heading", () => {
    nav.pathname = "/front-desk";
    render(<TopBar menuOpen={false} onOpenMenu={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Front Desk Calendar",
    );
  });

  it("reflects the drawer state on the menu button", () => {
    render(<TopBar menuOpen onOpenMenu={() => {}} />);
    expect(
      screen.getByRole("button", { name: /open navigation menu/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
