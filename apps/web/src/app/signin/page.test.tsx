import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SignInPage from "./page";

/**
 * Sign-in affordance (Story 2.2). Recovery is ByteAuth's: we only assert the
 * thin redirect — a ByteAuth link when configured, a graceful fallback when not.
 */
afterEach(() => vi.unstubAllEnvs());

describe("/signin (ByteAuth redirect)", () => {
  it("links to BytePlane/ByteAuth when NEXT_PUBLIC_BYTEPLANE_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_BYTEPLANE_URL", "https://app.bytebazaar.co.ke");
    render(<SignInPage />);
    expect(
      screen.getByRole("link", { name: /sign in via bytestay/i }),
    ).toHaveAttribute("href", "https://app.bytebazaar.co.ke");
  });

  it("falls back to a message (no broken link) when the URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_BYTEPLANE_URL", "");
    render(<SignInPage />);
    expect(
      screen.queryByRole("link", { name: /sign in via bytestay/i }),
    ).toBeNull();
    expect(
      screen.getByText(/open bytestay from your byteplane launcher/i),
    ).toBeInTheDocument();
  });
});
