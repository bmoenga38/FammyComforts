"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { Id } from "@fammycomforts/backend/convex/_generated/dataModel";
import { formatKes, kesToCents } from "@/lib/money";
import { Button, Card, CardContent, Input, StatusChip } from "@/components/ui";

/**
 * Room detail + no-account booking (Stories 4.2, 4.4–4.7). Shows amenities,
 * policies, and exact stay pricing; the form collects guest details + required
 * consent, optional ID images (signed upload URLs), and payment-method intent.
 * On success it shows the BK- reference (confirmation).
 */
type Confirmation = {
  reference: string;
  nights: number;
  expectedTotalCents: bigint;
  currency: string;
};

const PAYMENT_METHODS = [
  { value: "mpesa_stk", label: "M-Pesa" },
  { value: "cash", label: "Cash at property" },
  { value: "card", label: "Card" },
] as const;

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
  const createBooking = useMutation(api.guestBookings.create);
  const generateUploadUrl = useMutation(api.guestBookings.generateUploadUrl);

  // Guest form state.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [method, setMethod] =
    useState<(typeof PAYMENT_METHODS)[number]["value"]>("mpesa_stk");
  const [deposit, setDeposit] = useState("");
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);

  if (detail === undefined) {
    return <p className="p-8 text-sm text-fg-muted">Loading room…</p>;
  }
  if (detail === null) {
    return <p className="p-8 text-sm text-fg-muted">Room not found.</p>;
  }

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        paymentMethod: method,
        paymentSplits: deposit
          ? [{ method, amountCents: kesToCents(deposit) }]
          : undefined,
        documents: documents.length ? documents : undefined,
      });
      setConfirmed(res);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-4 md:p-8">
        <Card>
          <CardContent className="space-y-3 text-center">
            <StatusChip status="success">Booking received</StatusChip>
            <h1 className="text-2xl font-semibold">{confirmed.reference}</h1>
            <p className="text-sm text-fg-muted">
              {confirmed.nights} nights · {formatKes(confirmed.expectedTotalCents)}{" "}
              incl. tax · status pending until the property confirms.
            </p>
            <p className="text-sm text-fg-muted">
              Save this reference — you can check your booking anytime with it and
              your phone number.
            </p>
            <Link href={`/book/${orgSlug}/lookup`} className="text-sm underline">
              Look up my booking
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <Link href={`/book/${orgSlug}`} className="text-sm text-fg-muted underline">
        ← All rooms
      </Link>

      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">
          {detail.typeName} · Room {detail.number}
        </h1>
        <p className="text-sm text-fg-muted">
          {detail.propertyName} · {detail.branchName}
          {detail.location ? ` · ${detail.location}` : ""}
        </p>
      </header>

      <Card>
        <CardContent className="space-y-2 text-sm">
          <p>
            Sleeps {detail.capacity}
            {detail.sizeSqm ? ` · ${detail.sizeSqm} m²` : ""}
            {detail.floor ? ` · floor ${detail.floor}` : ""}
          </p>
          {detail.amenities.length > 0 && (
            <p className="text-fg-muted">{detail.amenities.join(" · ")}</p>
          )}
          <p>
            Check-in {detail.checkInTime ?? "—"} · Check-out{" "}
            {detail.checkOutTime ?? "—"}
            {detail.idRequired ? " · ID required at check-in" : ""}
          </p>
          {detail.cancellationNote && (
            <p className="text-fg-muted">{detail.cancellationNote}</p>
          )}
          <p className="font-medium">
            {detail.nightlyCents !== null
              ? `${formatKes(detail.nightlyCents)}/night`
              : "Contact property for rates"}
            {detail.totals &&
              ` · ${detail.nights} nights = ${formatKes(detail.totals.totalCents)} incl. tax`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-medium">Book this room</h2>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-fg-muted">Check-in</span>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-40"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-fg-muted">Check-out</span>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-40"
                required
              />
            </label>
          </div>

          {hasDates && !detail.available ? (
            <p className="text-sm text-warning">
              This room isn’t available for those dates — try different dates or
              another room.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <Input
                aria-label="Full name"
                placeholder="Full name *"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <div className="flex flex-wrap gap-3">
                <Input
                  aria-label="Phone"
                  placeholder="Phone (e.g. +2547…) *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-56"
                />
                <Input
                  aria-label="Email"
                  type="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-64"
                />
              </div>
              <Input
                aria-label="ID number"
                placeholder="ID / passport number (optional)"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-64"
              />

              <div className="flex flex-wrap gap-4 text-sm">
                <label>
                  <span className="mb-1 block text-fg-muted">ID front (optional)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdFront(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-fg-muted">ID back (optional)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdBack(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-fg-muted">I’ll pay by</span>
                  <select
                    aria-label="Payment method"
                    className="rounded-lg border border-border bg-bg-input px-2 py-2 text-sm"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-fg-muted">
                    Deposit now, KES (optional)
                  </span>
                  <Input
                    aria-label="Deposit amount"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    className="w-32"
                  />
                </label>
              </div>
              <p className="text-xs text-fg-muted">
                No charge is made now — payment is settled with the property.
              </p>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I consent to {detail.propertyName} storing my details to manage
                  this booking. *
                </span>
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={!consent || !hasDates || submitting}>
                {submitting ? "Booking…" : "Confirm booking"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
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
