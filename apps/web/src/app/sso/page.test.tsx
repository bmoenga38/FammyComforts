import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * /sso landing route (Story 2.1, A1). Mocks the auth action + router so we can
 * assert the client contract: a valid token is exchanged via the `sso-handoff`
 * provider and redirects in; a missing/failed token surfaces an error and never
 * navigates.
 */
const nav = { token: null as string | null, replace: vi.fn() };
const signIn = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "token" ? nav.token : null),
  }),
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn }),
}));

import SsoPage from "./page";

beforeEach(() => {
  nav.token = null;
  nav.replace.mockReset();
  signIn.mockReset();
});

describe("/sso route", () => {
  it("shows an error and does not sign in when the token is missing", async () => {
    nav.token = null;
    render(<SsoPage />);
    expect(await screen.findByText(/missing sign-in token/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("exchanges the token via the sso-handoff provider and redirects", async () => {
    nav.token = "bys_abc";
    signIn.mockResolvedValue({ signingIn: true });
    render(<SsoPage />);
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("sso-handoff", { token: "bys_abc" }),
    );
    await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(1));
  });

  it("surfaces an error and does not redirect when sign-in fails", async () => {
    nav.token = "bys_bad";
    signIn.mockRejectedValue(new Error("invalid"));
    render(<SsoPage />);
    expect(
      await screen.findByText(/invalid or has expired/i),
    ).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("attempts sign-in only once (tokens are single-use)", async () => {
    nav.token = "bys_once";
    signIn.mockResolvedValue({ signingIn: true });
    const { rerender } = render(<SsoPage />);
    rerender(<SsoPage />);
    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
