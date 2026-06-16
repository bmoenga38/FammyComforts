"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConvex } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { Button, Input, PoweredBy } from "@/components/ui";
import { Smartphone, ShieldUser, Lock, LockOpen, KeyRound, UserPlus, Eye, EyeOff } from "lucide-react";

/**
 * Sign-in (prototype login gate, ui-samples/fammycomfort_pwa loginHTML):
 * glass card with the brand-mark, two tabs — Phone (customers & staff, phone +
 * password) and Admin (email + password). The phone tab is two steps: enter the
 * phone, then — based on `accounts.phoneStatus` — either ENTER the password
 * (returning user), SET a password (admin-provisioned account's first login), or
 * REGISTER (unknown phone → new customer). Backed by the `phone-password` /
 * `demo-admin` Convex Auth providers; production ByteAuth SSO stays available
 * via the footer link. Admin role is never reachable from the phone tab.
 */
type Mode = "phone" | "admin";
// Phone tab steps: enter phone → then one of: returning login / first-login
// set-password / new-customer registration.
type PhoneStep = "phone" | "login" | "set-password" | "register";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("phone");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("phone");
  const [phone, setPhone] = useState("");
  const [knownName, setKnownName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPhonePassword, setShowPhonePassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPhoneStep("phone");
    setError(null);
  };

  const resetPhoneFields = () => {
    setPhonePassword("");
    setConfirmPassword("");
    setName("");
    setRegEmail("");
    setKnownName(null);
  };

  // Step 1: look up what this phone needs and branch to the right step.
  const continuePhone = async () => {
    setError(null);
    if (phone.replace(/\D/g, "").length < 9) {
      return setError("Enter a valid phone number.");
    }
    setBusy(true);
    try {
      const res = await convex.query(api.accounts.phoneStatus, { phone });
      resetPhoneFields();
      if (res.status === "blocked") {
        return setError("This number can't sign in here. Admins use the Admin tab.");
      }
      if (res.status === "login") setKnownName(res.name ?? null);
      setPhoneStep(res.status);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2: submit the password (login), set a first password, or register.
  const submitPhone = async () => {
    setError(null);
    if (phoneStep === "register" && name.trim().replace(/\s+/g, " ").length < 3) {
      return setError("Enter your full name.");
    }
    if (phonePassword.length < 8) {
      return setError("Password must be at least 8 characters.");
    }
    if (phoneStep !== "login" && phonePassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    setBusy(true);
    try {
      await signIn("phone-password", {
        mode: phoneStep,
        phone,
        password: phonePassword,
        ...(phoneStep === "register" ? { name, email: regEmail || undefined } : {}),
      });
      router.replace("/");
    } catch {
      setError(
        phoneStep === "login"
          ? "Incorrect password. Please try again."
          : "Could not complete sign-in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const adminSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn("demo-admin", { email, password });
      router.replace("/");
    } catch {
      setError("Invalid admin credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <div className="glass-panel fade-in w-full max-w-[420px] rounded-[22px] p-7">
        <div className="mb-5 text-center">
          <span className="brand-mark mx-auto mb-3 grid size-14 text-[28px]">F</span>
          <h1 className="font-hero text-[26px] font-extrabold text-text">Fammy Comforts</h1>
          <p className="mt-1 text-body-md text-text-muted">
            All-in-one rooms, bookings, guests &amp; operations
          </p>
        </div>

        <div className="seg mb-5 w-full" role="tablist" aria-label="Sign-in method">
          <button
            role="tab"
            aria-selected={mode === "phone"}
            className={`seg-btn flex-1 justify-center ${mode === "phone" ? "active" : ""}`}
            onClick={() => switchMode("phone")}
          >
            <Smartphone className="size-4" aria-hidden="true" /> Phone
          </button>
          <button
            role="tab"
            aria-selected={mode === "admin"}
            className={`seg-btn flex-1 justify-center ${mode === "admin" ? "active" : ""}`}
            onClick={() => switchMode("admin")}
          >
            <ShieldUser className="size-4" aria-hidden="true" /> Admin
          </button>
        </div>

        {mode === "phone" && phoneStep === "phone" && (
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              Phone number
              <Input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && continuePhone()}
                placeholder="+254 7XX XXX XXX"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button fullWidth disabled={busy} onClick={continuePhone}>
              <Smartphone className="size-4" aria-hidden="true" />{" "}
              {busy ? "Checking…" : "Continue"}
            </Button>
            <p className="text-center text-body-md text-text-muted">
              Guests &amp; staff sign in with their phone number.
            </p>
          </div>
        )}

        {mode === "phone" && phoneStep !== "phone" && (
          <div className="space-y-3">
            {phoneStep === "login" && (
              <p className="text-body-md text-text-muted">
                Welcome back{knownName ? <>, <b className="text-text">{knownName}</b></> : ""} — enter your
                password for <b className="text-text font-mono">{phone}</b>.
              </p>
            )}
            {phoneStep === "set-password" && (
              <p className="text-label-caps flex items-center gap-1.5 uppercase text-text-muted">
                <KeyRound className="size-3.5" aria-hidden="true" /> First sign-in · set your password
              </p>
            )}
            {phoneStep === "register" && (
              <>
                <p className="text-label-caps flex items-center gap-1.5 uppercase text-text-muted">
                  <UserPlus className="size-3.5" aria-hidden="true" /> Create your account
                </p>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                  Full name
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Muthoni" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                  Email <span className="font-normal opacity-60">(optional)</span>
                  <Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              {phoneStep === "login" ? "Password" : "Create a password"}
              <div className="relative">
                <Input
                  type={showPhonePassword ? "text" : "password"}
                  value={phonePassword}
                  onChange={(e) => setPhonePassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && phoneStep === "login" && submitPhone()}
                  placeholder={phoneStep === "login" ? "Your password" : "At least 8 characters"}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPhonePassword((v) => !v)}
                  aria-label={showPhonePassword ? "Hide password" : "Show password"}
                  aria-pressed={showPhonePassword}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-ctrl text-text-muted transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
                >
                  {showPhonePassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </label>

            {phoneStep !== "login" && (
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                Confirm password
                <Input
                  type={showPhonePassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                />
              </label>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            <Button fullWidth disabled={busy} onClick={submitPhone}>
              <LockOpen className="size-4" aria-hidden="true" />{" "}
              {busy
                ? "Please wait…"
                : phoneStep === "login"
                  ? "Sign in"
                  : phoneStep === "register"
                    ? "Create account & sign in"
                    : "Set password & sign in"}
            </Button>
            <button
              className="mx-auto block text-sm text-text-muted underline"
              onClick={() => { setPhoneStep("phone"); resetPhoneFields(); setError(null); }}
            >
              ← Change number
            </button>
          </div>
        )}

        {mode === "admin" && (
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              Email
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@fammycomforts.co.ke" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              Password
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-ctrl text-text-muted transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button fullWidth disabled={busy} onClick={adminSignIn}>
              <Lock className="size-4" aria-hidden="true" />{" "}
              {busy ? "Signing in…" : "Sign in to dashboard"}
            </Button>
            <p className="text-center text-body-md text-text-muted">
              Sign in with your admin email &amp; password.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-2 text-center">
          <PoweredBy />
        </div>
      </div>
    </main>
  );
}
