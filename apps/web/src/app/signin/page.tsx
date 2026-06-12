"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button, Input } from "@/components/ui";
import { Smartphone, ShieldUser, Lock, LockOpen, MessageSquareText, UserPlus } from "lucide-react";

/**
 * Sign-in (prototype login gate, ui-samples/fammycomfort_pwa loginHTML):
 * glass card with the brand-mark, two tabs — Phone OTP (customers & staff,
 * fixed demo code shown as a FammyComfort SMS preview) and Admin (email +
 * password). Unknown phones are forced through registration (new customer,
 * Bronze, +100 welcome points). Backed by the `demo-otp` / `demo-admin`
 * Convex Auth providers; the production ByteAuth SSO path stays available
 * via the footer link. Admin role is never reachable from the phone tab.
 */
type Mode = "phone" | "admin";
type Step = "enter" | "otp";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const byteplaneUrl = process.env.NEXT_PUBLIC_BYTEPLANE_URL;

  const [mode, setMode] = useState<Mode>("phone");
  const [step, setStep] = useState<Step>("enter");
  const [registering, setRegistering] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("enter");
    setRegistering(false);
    setError(null);
  };

  const sendOtp = () => {
    setError(null);
    if (phone.replace(/\D/g, "").length < 9) {
      return setError("Enter a valid phone number.");
    }
    if (registering && name.trim().replace(/\s+/g, " ").length < 3) {
      return setError("Enter your full name.");
    }
    setStep("otp");
  };

  const verify = async () => {
    setError(null);
    if (otp.replace(/\D/g, "").length < 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    try {
      await signIn("demo-otp", {
        phone,
        otp,
        ...(registering ? { name, email: regEmail || undefined } : {}),
      });
      router.replace("/");
    } catch {
      if (!registering) {
        // Unknown number → force registration (per the login rules).
        setRegistering(true);
        setStep("enter");
        setError(`No account for ${phone} yet — register below to continue.`);
      } else {
        setError("Verification failed — check the code and try again.");
      }
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
            <Smartphone className="size-4" aria-hidden="true" /> Phone OTP
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

        {mode === "phone" && step === "enter" && (
          <div className="space-y-3">
            {registering && (
              <>
                <p className="text-label-caps flex items-center gap-1.5 uppercase text-text-muted">
                  <UserPlus className="size-3.5" aria-hidden="true" /> Create your account
                </p>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                  Full name
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Muthoni" />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              Phone number
              <Input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 7XX XXX XXX"
              />
            </label>
            {registering && (
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                Email <span className="font-normal opacity-60">(optional)</span>
                <Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" />
              </label>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button fullWidth onClick={sendOtp}>
              <MessageSquareText className="size-4" aria-hidden="true" />{" "}
              {registering ? "Register & send OTP" : "Send OTP"}
            </Button>
            <Button fullWidth variant="ghost" onClick={() => { setRegistering(!registering); setError(null); }}>
              {registering ? "I already have an account" : "New here? Create an account"}
            </Button>
            <p className="text-center text-body-md text-text-muted">
              Guests &amp; staff sign in with their phone number.
            </p>
          </div>
        )}

        {mode === "phone" && step === "otp" && (
          <div className="space-y-3">
            <p className="text-body-md text-text-muted">
              Enter the 6-digit code sent to <b className="text-text">{phone}</b>
            </p>
            {DEMO_MODE && (
              <div className="card card-pad-sm !p-4 text-left">
                <p className="sms-sender">FammyComfort</p>
                <div className="sms-bubble text-text">
                  {registering ? `Karibu ${name.split(" ")[0] || "guest"}! ` : ""}
                  Your Fammy Comforts verification code is <b className="font-mono">123456</b>.
                  It expires in 5 minutes. Do not share it with anyone.
                </div>
              </div>
            )}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              One-time code
              <Input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="••••••"
                className="text-center font-mono text-2xl font-bold tracking-[12px]"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button fullWidth disabled={busy} onClick={verify}>
              <LockOpen className="size-4" aria-hidden="true" />{" "}
              {busy ? "Verifying…" : registering ? "Verify & create account" : "Verify & sign in"}
            </Button>
            <div className="flex justify-between">
              <button className="text-sm text-text-muted underline" onClick={() => setStep("enter")}>
                ← {registering ? "Edit details" : "Change number"}
              </button>
              <button className="text-sm text-text-muted underline" onClick={() => setError(null)}>
                Resend code
              </button>
            </div>
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
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button fullWidth disabled={busy} onClick={adminSignIn}>
              <Lock className="size-4" aria-hidden="true" />{" "}
              {busy ? "Signing in…" : "Sign in to dashboard"}
            </Button>
            <p className="text-center text-body-md text-text-muted">
              Demo · use your admin email + the demo password
            </p>
          </div>
        )}

        <div className="mt-6 space-y-2 text-center">
          {byteplaneUrl && (
            <a href={byteplaneUrl} className="text-sm text-primary underline">
              Sign in via ByteStay (SSO)
            </a>
          )}
          <p className="text-xs text-text-muted">
            Powered by{" "}
            <a
              href="https://bytebazaar-plane.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary no-underline"
            >
              ByteBazaar Tech Labs
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
