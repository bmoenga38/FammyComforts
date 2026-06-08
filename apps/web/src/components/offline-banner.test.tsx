import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfflineBanner } from "./offline-banner";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

describe("OfflineBanner", () => {
  afterEach(() => setOnline(true));

  it("renders nothing when online", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows an announced banner when offline", () => {
    setOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/offline/i);
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
