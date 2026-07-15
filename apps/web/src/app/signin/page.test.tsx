import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Sign-in gate: Phone tab (default, phone + password — two steps via
 * `accounts.phoneStatus`), Admin tab with email + password, and the
 * `phone-password` / `demo-admin` signIn contracts.
 */
const signIn = vi.fn();
const replace = vi.fn();
const query = vi.fn();

vi.mock("convex/react", () => ({ useConvex: () => ({ query }) }));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: { accounts: { phoneStatus: "accounts.phoneStatus" } },
}));

import SignInPage from "./page";

beforeEach(() => {
  signIn.mockReset();
  replace.mockReset();
  query.mockReset();
});

/** Type a phone and click Continue (step 1 → step 2). */
async function continueWithPhone(value: string) {
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
}

describe("sign-in screen", () => {
  it("defaults to the Phone tab with a phone field + Continue", () => {
    render(<ToastProvider><SignInPage /></ToastProvider>);
    expect(screen.getByRole("tab", { name: /^phone$/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("switching to Admin shows email + password", () => {
    render(<ToastProvider><SignInPage /></ToastProvider>);
    fireEvent.click(screen.getByRole("tab", { name: /admin/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to dashboard/i })).toBeInTheDocument();
  });

  it("a returning phone advances to the password step and signs in", async () => {
    query.mockResolvedValue({ status: "login", name: "Grace Achieng" });
    signIn.mockResolvedValue({ signingIn: true });
    render(<ToastProvider><SignInPage /></ToastProvider>);
    await continueWithPhone("0711203040");

    expect(query).toHaveBeenCalledWith("accounts.phoneStatus", { phone: "0711203040" });
    const pwd = await screen.findByLabelText("Password");
    fireEvent.change(pwd, { target: { value: "sup3rsecret" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(signIn).toHaveBeenCalledWith(
      "phone-password",
      expect.objectContaining({ mode: "login", phone: "0711203040", password: "sup3rsecret" }),
    );
  });

  it("first login (no password yet) asks the user to set one", async () => {
    query.mockResolvedValue({ status: "set-password", name: "Dennis" });
    signIn.mockResolvedValue({ signingIn: true });
    render(<ToastProvider><SignInPage /></ToastProvider>);
    await continueWithPhone("0733407080");

    const pwd = await screen.findByLabelText(/create a password/i);
    fireEvent.change(pwd, { target: { value: "brandnewpass" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "brandnewpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set password & sign in/i }));

    expect(signIn).toHaveBeenCalledWith(
      "phone-password",
      expect.objectContaining({ mode: "set-password", phone: "0733407080", password: "brandnewpass" }),
    );
  });

  it("an unknown phone collects name + password to register", async () => {
    query.mockResolvedValue({ status: "register" });
    render(<ToastProvider><SignInPage /></ToastProvider>);
    await continueWithPhone("0700000000");

    expect(await screen.findByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/create a password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account & sign in/i })).toBeInTheDocument();
  });

  it("a blocked phone (admin/deactivated) shows a guidance message", async () => {
    query.mockResolvedValue({ status: "blocked" });
    render(<ToastProvider><SignInPage /></ToastProvider>);
    await continueWithPhone("0786975525");

    // The guidance now surfaces both inline and as a toast, so match either/both.
    expect(
      (await screen.findAllByText(/admins use the admin tab/i)).length,
    ).toBeGreaterThan(0);
    expect(signIn).not.toHaveBeenCalled();
  });
});
