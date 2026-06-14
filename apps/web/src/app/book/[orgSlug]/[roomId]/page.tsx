"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { Id } from "@fammycomforts/backend/convex/_generated/dataModel";
import { formatKes, kesToCents } from "@/lib/money";
import { roomImage, roomGradient } from "@/lib/room-images";
import { Button, Input, StatusChip } from "@/components/ui";
import { Check, Users, BadgeCheck } from "lucide-react";

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

function RoomBooking() {
  const { orgSlug, roomId } = useParams<{ orgSlug: string; roomId: string }>();
  const sp = useSearchParams();
  const [checkIn, setCheckIn] = useState(sp.get("in") ?? "");
  const [checkOut, setCheckOut] = useState(sp.get("out") ?? "");
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

  const [step, setStep] = useState<0 | 1 | 2>(0);
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
    setStep(1);
  };

  async function submit() {
    setError(null);
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
      setError(String((err as Error).message ?? err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-4 md:p-8">
      <Link href={`/book/${orgSlug}`} className="text-sm text-text-muted underline">
        ← All rooms
      </Link>

      <div className="card fade-in mt-4 overflow-hidden p-0">
        {/* Media header (prototype detail-hero) */}
        <figure
          className="relative m-0 aspect-[16/9]"
          style={{ background: roomGradient(detail.typeName + detail.number) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roomImage(detail.typeName + detail.number)}
            alt={`${detail.typeName} room`}
            className="absolute inset-0 size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,19,38,0.9),transparent_60%)]" />
          <div className="absolute bottom-4 left-5 right-5">
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
        </figure>

        <div className="p-5 md:p-6">
          <Stepper step={step} />

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
                  ID / Passport number (optional)
                  <Input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="e.g. 12345678"
                  />
                </label>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-text-muted">
                  <label className="flex flex-col gap-1.5">
                    ID front (optional)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdFront(e.target.files?.[0] ?? null)}
                      className="text-text-muted"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    ID back (optional)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIdBack(e.target.files?.[0] ?? null)}
                      className="text-text-muted"
                    />
                  </label>
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
    </main>
  );
}

export default function RoomBookingPage() {
  return (
    <Suspense fallback={null}>
      <RoomBooking />
    </Suspense>
  );
}
