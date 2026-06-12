import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Prototype login gate: Phone OTP tab (default) with the demo SMS preview,
 * Admin tab with email+password, and the demo-otp signIn contract.
 */
const signIn = vi.fn();
const replace = vi.fn();

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import SignInPage from "./page";

beforeEach(() => {
  signIn.mockReset();
  replace.mockReset();
});

describe("sign-in screen", () => {
  it("defaults to the Phone OTP tab with a phone field", () => {
    render(<SignInPage />);
    expect(screen.getByRole("tab", { name: /phone otp/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send otp/i })).toBeInTheDocument();
  });

  it("switching to Admin shows email + password", () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByRole("tab", { name: /admin/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in to dashboard/i })).toBeInTheDocument();
  });

  it("Send OTP advances to the code step with the FammyComfort demo SMS bubble", () => {
    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "0711203040" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
    expect(screen.getByText("FammyComfort")).toBeInTheDocument();
    expect(screen.getByText("123456")).toBeInTheDocument();
    expect(screen.getByLabelText(/one-time code/i)).toBeInTheDocument();
  });

  it("verify calls signIn('demo-otp') with the phone + code", async () => {
    signIn.mockResolvedValue({ signingIn: true });
    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "0711203040" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
    fireEvent.change(screen.getByLabelText(/one-time code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify & sign in/i }));
    expect(signIn).toHaveBeenCalledWith(
      "demo-otp",
      expect.objectContaining({ phone: "0711203040", otp: "123456" }),
    );
  });

  it("registration mode collects name + optional email", () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register & send otp/i })).toBeInTheDocument();
  });
});
