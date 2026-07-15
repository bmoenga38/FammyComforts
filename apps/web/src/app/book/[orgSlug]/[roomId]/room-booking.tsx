"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { Id } from "@fammycomforts/backend/convex/_generated/dataModel";
import { formatKes, kesToCents } from "@/lib/money";
import { errorMessage } from "@/lib/error-message";
import { roomImage, roomGradient } from "@/lib/room-images";
import { Button, Input, StatusChip } from "@/components/ui";
import {
  Check,
  Users,
  BadgeCheck,
  Upload,
  ShieldCheck,
  LogIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * Room detail + 3-step booking (Stories 4.2, 4.4–4.7), per the prototype's
 * openBooking flow (ui-samples/fammycomfort_pwa app.js): media header,
 * Details → Pay → Confirmed stepper, KYC fields (name as on ID, ID number,
 * optional ID photos), nights×rate total card, payment-method intent step,
 * and a confirmation with the BK- reference and the FAMMY SMS preview bubble.
 * Same Convex contract as before — only the presentation changed.
 * (Real QR pass + room photos are on the gap list.)
 */
type Confirmation = {
  reference: string;
  nights: number;
  expectedTotalCents: bigint;
  currency: string;
};

const METHOD_LABELS: Record<string, string> = {
  mpesa_stk: "M-Pesa",
  mpesa_manual: "M-Pesa (pay at desk)",
  cash: "Cash at property",
  card: "Card",
};


function Stepper({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="stepper mb-6" aria-label={`Booking step ${step + 1} of 3`}>
      {["Details", "Pay", "Confirmed"].map((label, i) => (
        <div key={label} className={`step ${i < step ? "done" : i === step ? "current" : ""}`}>
          <div className="dot">{i < step ? <Check className="size-4" aria-hidden="true" /> : i + 1}</div>
          <span className="lbl">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A styled, tappable ID-photo upload tile. The native file input is visually
 * hidden (still focusable/clickable via the wrapping label); the tile shows an
 * upload prompt, then flips to a check + filename once a photo is chosen.
 */
function IdUploadTile({
  label,
  file,
  onSelect,
}: {
  label: string;
  file: File | null;
  onSelect: (file: File | null) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-5 text-center transition-colors ${
        file
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-bg-input text-text-muted hover:border-border-focus hover:text-text"
      }`}
    >
      <input
        type="file"
        accept="image/*"
        required
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="sr-only"
        aria-label={`${label} (required)`}
      />
      {file ? (
        <Check className="size-5" aria-hidden="true" />
      ) : (
        <Upload className="size-5" aria-hidden="true" />
      )}
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="max-w-full truncate text-[11px] font-normal opacity-80">
        {file ? file.name : "Tap to upload"}
      </span>
    </label>
  );
}

type RoomBookingProps = {
  orgSlug?: string;
  roomId?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  /** Render inside a Modal: drops the page <main> wrapper + "All rooms" link. */
  asModal?: boolean;
};

/**
 * Swipeable room photo gallery for the detail view. Slides through the
 * uploaded images (scroll-snap + touch); falls back to the deterministic
 * placeholder when a room has no photos yet. Overlays (status chip, title)
 * are passed as children and sit above the slider (pointer-events-none).
 */
function RoomGallery({
  images,
  fallback,
  gradient,
  alt,
  children,
}: {
  images: string[];
  fallback: string;
  gradient: string;
  alt: string;
  children?: ReactNode;
}) {
  const slides = images && images.length > 0 ? images : [fallback];
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(i, slides.length - 1));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const track = trackRef.current;
    if (track) setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  return (
    <figure
      className="relative m-0 aspect-[16/9] overflow-hidden"
      style={{ background: gradient }}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="hide-scroll flex size-full snap-x snap-mandatory overflow-x-auto"
      >
        {slides.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt={`${alt} — photo ${i + 1}`}
            className="size-full shrink-0 snap-center object-cover"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        ))}
      </div>

      {children}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => goTo(active - 1)}
            className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => goTo(active + 1)}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          <div className="absolute right-3 top-3 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === active ? "w-5 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </figure>
  );
}

export function RoomBooking({
  orgSlug: pOrgSlug,
  roomId: pRoomId,
  initialCheckIn,
  initialCheckOut,
  asModal = false,
}: RoomBookingProps = {}) {
  const params = useParams<{ orgSlug: string; roomId: string }>();
  const sp = useSearchParams();
  const orgSlug = pOrgSlug ?? params.orgSlug;
  const roomId = pRoomId ?? params.roomId;
  const [checkIn, setCheckIn] = useState(initialCheckIn ?? sp.get("in") ?? "");
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? sp.get("out") ?? "");
  const hasDates = Boolean(checkIn && checkOut);

  const detail = useQuery(
    api.catalog.roomDetail,
    hasDates
      ? { orgSlug, roomId: roomId as Id<"rooms">, checkIn, checkOut }
      : { orgSlug, roomId: roomId as Id<"rooms"> },
  );
  const enabledMethods = useQuery(api.paymentMethods.enabledMethods, { orgSlug });
  const createBooking = useMutation(api.guestBookings.create);
  const generateUploadUrl = useMutation(api.guestBookings.generateUploadUrl);

  // Auth gate: bookings must be confirmed by a signed-in customer (browse is
  // public; the account unlocks Trips / Rewards / Order food).
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();

  const [step, setStep] = useState<0 | "auth" | 1 | 2>(0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState("mpesa_stk");
  const [deposit, setDeposit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);

  // Inline auth (phone-first, prefilled from the guest details already entered).
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const phoneStatus = useQuery(
    api.accounts.phoneStatus,
    step === "auth" && phone.replace(/\D/g, "").length >= 9 ? { phone } : "skip",
  );

  if (detail === undefined) {
    return <p className="p-8 text-sm text-text-muted">Loading room…</p>;
  }
  if (detail === null) {
    return <p className="p-8 text-sm text-text-muted">Room not found.</p>;
  }

  const guestMethods = (enabledMethods ?? ["mpesa_stk", "cash", "card"]).filter(
    (m) => m !== "mpesa_manual",
  );

  async function uploadDoc(
    file: File,
    kind: "id_front" | "id_back",
  ): Promise<{ kind: "id_front" | "id_back"; storageId: Id<"_storage"> }> {
    const url = await generateUploadUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Document upload failed — try again.");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return { kind, storageId };
  }

  const toPay = () => {
    setError(null);
    if (!hasDates) return setError("Pick your check-in and check-out dates.");
    if (!detail.available) return setError("This room isn't available for those dates.");
    if (!fullName.trim()) return setError("Enter the guest full name (as on ID).");
    if (phone.replace(/\D/g, "").length < 9) return setError("Enter a valid phone number.");
    if (!idNumber.trim()) return setError("Enter your ID or passport number.");
    if (!idFront) return setError("Upload a photo of the front of your ID.");
    if (!idBack) return setError("Upload a photo of the back of your ID.");
    // Gate: signed-in customers go straight to payment; guests must first
    // log in or create an account (prefilled from the details above).
    setStep(isAuthenticated ? 1 : "auth");
  };

  // Complete the inline auth, then advance to payment. Uses the phone the guest
  // already entered: known number → password login; new number → quick sign-up.
  async function doAuth() {
    setAuthError(null);
    const status = phoneStatus?.status;
    if (status === "blocked") {
      return setAuthError("This number can't book here. Staff use the staff sign-in.");
    }
    if (authPassword.length < 8) {
      return setAuthError("Password must be at least 8 characters.");
    }
    if (status !== "login" && authPassword !== authConfirm) {
      return setAuthError("Passwords do not match.");
    }
    setAuthBusy(true);
    try {
      const mode = status === "login" ? "login" : status === "set-password" ? "set-password" : "register";
      await signIn("phone-password", {
        mode,
        phone,
        password: authPassword,
        ...(mode === "register" ? { name: fullName, email: email || undefined } : {}),
      });
      setStep(1); // authenticated → proceed to payment
    } catch {
      setAuthError(
        status === "login"
          ? "Incorrect password. Please try again."
          : "Could not complete sign-in. Please try again.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function submit() {
    setError(null);
    // Client-side guard so the deposit can't exceed the total (the server also
    // enforces this; catching it here gives instant feedback).
    if (deposit.trim() && detail?.totals) {
      if (kesToCents(deposit) > detail.totals.totalCents) {
        return setError(
          `The deposit can't exceed the total of ${formatKes(detail.totals.totalCents)}.`,
        );
      }
    }
    setSubmitting(true);
    try {
      const documents = [];
      if (idFront) documents.push(await uploadDoc(idFront, "id_front"));
      if (idBack) documents.push(await uploadDoc(idBack, "id_back"));
      const res = await createBooking({
        orgSlug,
        roomId: roomId as Id<"rooms">,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guest: {
          fullName,
          phone,
          email: email || undefined,
          idNumber: idNumber || undefined,
        },
        consent,
        paymentMethod: method as "mpesa_stk" | "mpesa_manual" | "cash" | "card",
        paymentSplits: deposit
          ? [
              {
                method: method as "mpesa_stk" | "mpesa_manual" | "cash" | "card",
                amountCents: kesToCents(deposit),
              },
            ]
          : undefined,
        documents: documents.length ? documents : undefined,
      });
      setConfirmed(res);
      setStep(2);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={asModal ? "" : "mx-auto max-w-xl p-4 md:p-8"}>
      {!asModal && (
        <Link href={`/book/${orgSlug}`} className="text-sm text-text-muted underline">
          ← All rooms
        </Link>
      )}

      <div className={`card fade-in overflow-hidden p-0 ${asModal ? "" : "mt-4"}`}>
        {/* Media header (prototype detail-hero) */}
        <RoomGallery
          images={detail.images}
          fallback={roomImage(detail.typeName + detail.number)}
          gradient={roomGradient(detail.typeName + detail.number)}
          alt={`${detail.typeName} room`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(11,19,38,0.9),transparent_60%)]" />
          <div className="pointer-events-none absolute bottom-4 left-5 right-5">
            <div className="mb-1.5 flex gap-1.5">
              <StatusChip status={detail.available ? "success" : "warning"}>
                {detail.available ? "Available" : "Booked"}
              </StatusChip>
            </div>
            <h1 className="font-display text-headline-md text-white">
              {detail.typeName} · Room {detail.number}
            </h1>
            <p className="font-mono text-sm text-[#cdd6e8]">
              {detail.propertyName} · {detail.branchName}
              {detail.location ? ` · ${detail.location}` : ""}
            </p>
          </div>
        </RoomGallery>

        <div className="p-5 md:p-6">
          <Stepper step={step === "auth" ? 1 : step} />

          {step === 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden="true" /> sleeps {detail.capacity}
                  {detail.sizeSqm ? ` · ${detail.sizeSqm} m²` : ""}
                  {detail.floor ? ` · floor ${detail.floor}` : ""}
                </span>
                {detail.nightlyCents !== null && (
                  <span>
                    <span className="font-mono text-headline-sm text-primary">
                      {formatKes(detail.nightlyCents)}
                    </span>
                    /night
                  </span>
                )}
              </div>
              {detail.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.amenities.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 rounded-full bg-badge-info px-2.5 py-1 text-xs font-semibold text-badge-info-fg"
                    >
                      <Check className="size-3" aria-hidden="true" /> {a}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-body-md text-text-muted">
                Check-in {detail.checkInTime ?? "—"} · Check-out {detail.checkOutTime ?? "—"}
                {detail.idRequired ? " · ID required at check-in" : ""}
              </p>
              {detail.cancellationNote && (
                <p className="text-body-md text-text-muted">{detail.cancellationNote}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                  Check-in
                  <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                  Check-out
                  <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
                </label>
              </div>

              <p className="text-label-caps uppercase text-text-muted">Guest details</p>
              <div className="space-y-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                  Full name (as on ID)
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Muthoni"
                    required
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                    Phone
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+254 7XX XXX XXX"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                    Email (optional)
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                  <span>
                    ID / Passport number <span className="text-danger">*</span>
                  </span>
                  <Input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="e.g. 12345678"
                    required
                  />
                </label>
                <div className="space-y-2 text-xs font-semibold text-text-muted">
                  <span className="block">
                    Photo ID <span className="text-danger">*</span>
                    <span className="font-normal"> — front &amp; back required</span>
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <IdUploadTile label="Front of ID" file={idFront} onSelect={setIdFront} />
                    <IdUploadTile label="Back of ID" file={idBack} onSelect={setIdBack} />
                  </div>
                </div>
              </div>

              {detail.totals && detail.nightlyCents !== null && (
                <div className="card card-pad-sm flex items-center justify-between !p-4">
                  <span className="text-text-muted">
                    {formatKes(detail.nightlyCents)} × {detail.nights} nights · tax incl.
                  </span>
                  <span className="font-mono text-headline-sm text-primary">
                    {formatKes(detail.totals.totalCents)}
                  </span>
                </div>
              )}
              {hasDates && !detail.available && (
                <p className="text-sm text-warning">
                  This room isn’t available for those dates — try different dates or another
                  room.
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button fullWidth onClick={toPay}>
                Continue to payment →
              </Button>
            </div>
          )}

          {step === "auth" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                <p className="text-label-caps uppercase text-text-muted">
                  {phoneStatus?.status === "login" ? "Welcome back — sign in to confirm" : "Create your account to confirm"}
                </p>
              </div>
              <p className="text-body-md text-text-muted">
                Your booking is tied to your account so you can track it, pay, order food, and
                earn rewards. Using <b className="font-mono text-text">{phone}</b>.
              </p>

              {phoneStatus === undefined ? (
                <p className="text-body-md text-text-muted">Checking your number…</p>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                    {phoneStatus.status === "login" ? "Password" : "Create a password"}
                    <Input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && phoneStatus.status === "login" && doAuth()}
                      placeholder={phoneStatus.status === "login" ? "Your password" : "At least 8 characters"}
                    />
                  </label>
                  {phoneStatus.status !== "login" && (
                    <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                      Confirm password
                      <Input
                        type="password"
                        value={authConfirm}
                        onChange={(e) => setAuthConfirm(e.target.value)}
                        placeholder="Re-enter your password"
                      />
                    </label>
                  )}
                </>
              )}

              {authError && <p className="text-sm text-danger">{authError}</p>}
              <div className="flex gap-2.5">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  ← Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={authBusy || phoneStatus === undefined || phoneStatus.status === "blocked"}
                  onClick={doAuth}
                >
                  <LogIn className="size-4" aria-hidden="true" />{" "}
                  {authBusy
                    ? "Verifying…"
                    : phoneStatus?.status === "login"
                      ? "Sign in & continue"
                      : "Create account & continue"}
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-label-caps uppercase text-text-muted">
                {detail.totals ? `Pay ${formatKes(detail.totals.totalCents)}` : "Payment"}
              </p>

              <div className="space-y-2" role="radiogroup" aria-label="Payment method">
                {guestMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={`card card-pad-sm flex w-full items-center gap-3 !p-4 text-left transition-colors ${
                      method === m
                        ? "!border-[color-mix(in_srgb,var(--primary)_40%,transparent)] !bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]"
                        : ""
                    }`}
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-badge-success font-extrabold text-badge-success-fg">
                      {m.startsWith("mpesa") ? "M" : m === "cash" ? "C" : "K"}
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold tracking-wide text-text">
                        {METHOD_LABELS[m] ?? m}
                      </span>
                      {m === "mpesa_stk" && (
                        <span className="text-body-md text-primary">
                          STK push after booking — from your portal
                        </span>
                      )}
                    </span>
                    {method === m && (
                      <BadgeCheck className="size-5 text-primary" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>

              <div className="card card-pad-sm space-y-1.5 !p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Guest</span>
                  <span className="text-text">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Room</span>
                  <span className="font-mono text-text">
                    {detail.typeName} · {detail.number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Stay</span>
                  <span className="text-text">
                    {checkIn} → {checkOut}
                  </span>
                </div>
                {detail.totals && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Amount</span>
                    <span className="font-mono font-semibold text-primary">
                      {formatKes(detail.totals.totalCents)}
                    </span>
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
                Deposit now, KES (optional)
                <Input value={deposit} onChange={(e) => setDeposit(e.target.value)} className="w-36" />
              </label>
              <p className="text-xs text-text-muted">
                No charge is made now — payment is settled with the property.
              </p>

              <label className="flex items-start gap-2.5 text-sm text-text">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I consent to {detail.propertyName} storing my details to manage this
                  booking. *
                </span>
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex gap-2.5">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  ← Back
                </Button>
                <Button className="flex-1" disabled={!consent || submitting} onClick={submit}>
                  {submitting ? "Booking…" : "Confirm booking"}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && confirmed && (
            <div className="space-y-4 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-badge-success">
                <Check className="size-8 text-badge-success-fg" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-headline-md text-text">Booking confirmed!</h2>
                <p className="mt-1 font-mono text-headline-sm text-primary">
                  {confirmed.reference}
                </p>
                <p className="mt-1 text-body-md text-text-muted">
                  {fullName} · {confirmed.nights} nights ·{" "}
                  {formatKes(confirmed.expectedTotalCents)} incl. tax
                </p>
              </div>
              <div className="card card-pad-sm !p-4 text-left">
                <p className="sms-sender">FAMMY</p>
                <div className="sms-bubble text-text">
                  Hi {fullName.split(" ")[0]}, booking {confirmed.reference} for{" "}
                  {detail.typeName} (Room {detail.number}) is RECEIVED. Check-in {checkIn}.
                  Total {formatKes(confirmed.expectedTotalCents)}. Karibu!
                </div>
              </div>
              <p className="text-body-md text-text-muted">
                Save this reference — check your booking anytime with it and your phone
                number{method === "mpesa_stk" ? ", and pay via M-Pesa from your portal" : ""}.
              </p>
              <div className="flex gap-2.5">
                <Link href={`/book/${orgSlug}/lookup`} className="btn btn-ghost flex-1">
                  Open my portal
                </Link>
                <Link href={`/book/${orgSlug}`} className="btn btn-primary flex-1">
                  Done
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

