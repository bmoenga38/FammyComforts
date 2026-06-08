import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  beforeEach(() => {
    nav.pathname = "/guest";
  });

  it("exposes a skip-to-content link targeting the main landmark", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(
      screen.getByRole("link", { name: /skip to content/i }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("opens the drawer from the menu button and closes it from the scrim", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(
      screen.queryByRole("button", { name: /close navigation menu/i }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /open navigation menu/i }),
    );
    const scrim = screen.getByRole("button", { name: /close navigation menu/i });
    expect(scrim).toBeInTheDocument();

    fireEvent.click(scrim);
    expect(
      screen.queryByRole("button", { name: /close navigation menu/i }),
    ).toBeNull();
  });

  it("closes the open drawer when Escape is pressed", () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /open navigation menu/i }),
    );
    expect(
      screen.getByRole("button", { name: /close navigation menu/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: /close navigation menu/i }),
    ).toBeNull();
  });
});
