"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes, kesToCents } from "@/lib/money";
import { Button, Input, StatusChip } from "@/components/ui";
import {
  ArrowLeft,
  Search,
  Ticket,
  Smartphone,
  Receipt,
  FileText,
  ConciergeBell,
  CalendarRange,
  Send,
} from "lucide-react";

/**
 * Guest portal (Stories 4.8 + 5.7): verified by reference + the phone/email
 * used to book. Shows status, derived balance, payments, invoices/receipts
 * (print views), a request box, and M-Pesa STK payment initiation (5.3).
 * Styled to the prototype design system (glass cards, mono money/codes).
 */
export default function PortalPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [query, setQuery] = useState<{ reference: string; contact: string } | null>(null);

  const portal = useQuery(api.guestBookings.portal, query ?? "skip");
  const submitRequest = useMutation(api.guestRequests.submit);
  const initiateStk = useAction(api.mpesa.initiateStk);

  const [message, setMessage] = useState("");
  const [requestNote, setRequestNote] = useState<string | null>(null);
  const [payPhone, setPayPhone] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const statusTone =
    portal?.status === "cancelled" || portal?.status === "no_show"
      ? "danger"
      : portal?.status === "pending"
        ? "warning"
        : "success";

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4 md:p-8">
      <Link
        href={`/book/${orgSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All rooms
      </Link>

      <header className="fade-in">
        <p className="eyebrow mb-1">Guest portal</p>
        <h1 className="hero-title font-display text-headline-lg">Find my booking</h1>
        <p className="mt-1 text-body-lg text-text-muted">
          Enter your reference and the phone or email you booked with.
        </p>
      </header>

      {/* Lookup card */}
      <form
        className="card fade-in space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (reference && contact) setQuery({ reference, contact });
        }}
      >
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
          Booking reference
          <div className="relative">
            <Ticket
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              aria-label="Booking reference"
              placeholder="BK-XXXXXX"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              className="pl-9 font-mono uppercase tracking-wide"
              required
            />
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
          Phone or email
          <div className="relative">
            <Smartphone
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              aria-label="Phone or email"
              placeholder="07XX XXX XXX or you@example.com"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="pl-9"
              required
            />
          </div>
        </label>
        <Button type="submit" fullWidth disabled={!reference || !contact}>
          <Search className="size-4" aria-hidden="true" /> Look up my booking
        </Button>
      </form>

      {query && portal === undefined && (
        <div className="card flex items-center gap-3 text-body-md text-text-muted">
          <span className="spinner" aria-hidden="true" /> Searching…
        </div>
      )}
      {query && portal === null && (
        <div className="card !border-[rgba(244,63,94,.35)] !bg-[rgba(244,63,94,.07)] text-body-md text-text">
          No booking matches that reference and contact. Check both and try again.
        </div>
      )}

      {portal && query && (
        <div className="fade-in space-y-4">
          {/* Booking summary */}
          <section className="card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-headline-sm text-text">{portal.reference}</span>
              <StatusChip status={statusTone}>
                {portal.status.replaceAll("_", " ")}
              </StatusChip>
            </div>
            <div className="flex items-center gap-2 text-body-md text-text">
              <ConciergeBell className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
              {portal.propertyName} · {portal.roomType} ·{" "}
              <span className="font-mono">Rm {portal.roomNumber}</span>
            </div>
            <div className="flex items-center gap-2 text-body-md text-text-muted">
              <CalendarRange className="size-4 shrink-0" aria-hidden="true" />
              <span className="font-mono">{portal.checkInDate} → {portal.checkOutDate}</span> ·{" "}
              {portal.guestName}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-3">
              <div>
                <p className="text-label-caps uppercase text-text-muted">Total</p>
                <p className="font-mono text-text">{formatKes(portal.expectedTotalCents)}</p>
              </div>
              <div className="text-right">
                <p className="text-label-caps uppercase text-text-muted">Balance due</p>
                <p
                  className={`font-mono text-headline-sm ${
                    portal.balanceCents > 0n ? "text-warning" : "text-primary"
                  }`}
                >
                  {formatKes(portal.balanceCents)}
                </p>
              </div>
            </div>
          </section>

          {/* Pay with M-Pesa */}
          {portal.balanceCents > 0n && (
            <section className="card space-y-3">
              <h3 className="flex items-center gap-2 font-display text-headline-sm text-text">
                <Smartphone className="size-4 text-primary" aria-hidden="true" /> Pay with M-Pesa
              </h3>
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="M-Pesa phone"
                  placeholder="07XX XXX XXX"
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  className="w-full font-mono sm:flex-1"
                />
                <Input
                  aria-label="Amount KES"
                  placeholder="Amount (KES)"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full font-mono sm:w-36"
                />
              </div>
              <Button
                fullWidth
                disabled={busy || !payPhone || !payAmount}
                onClick={async () => {
                  setPayNote(null);
                  setBusy(true);
                  try {
                    const res = await initiateStk({
                      reference: query.reference,
                      contact: query.contact,
                      phone: payPhone,
                      amountCents: kesToCents(payAmount),
                    });
                    setPayNote(res.customerMessage);
                  } catch (err) {
                    setPayNote(String((err as Error).message ?? err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Sending…" : "Send STK push to my phone"}
              </Button>
              {payNote && (
                <p className="rounded-ctrl bg-bg-input px-3 py-2 text-body-md text-text-muted">
                  {payNote}
                </p>
              )}
            </section>
          )}

          {/* Payments */}
          {portal.payments.length > 0 && (
            <section className="card">
              <h3 className="mb-2 flex items-center gap-2 font-display text-headline-sm text-text">
                <Receipt className="size-4" aria-hidden="true" /> Payments
              </h3>
              <div className="divide-rows">
                {portal.payments.map((p, i) => (
                  <div key={i} className="list-row !px-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-text">{p.provider.replaceAll("_", " ")}</p>
                      {p.receiptNumber && (
                        <p className="font-mono text-[11px] text-text-dim">{p.receiptNumber}</p>
                      )}
                    </div>
                    <span className="font-mono text-body-md text-text">
                      {formatKes(p.amountCents)}
                    </span>
                    <StatusChip status={p.status === "confirmed" ? "success" : "warning"}>
                      {p.status}
                    </StatusChip>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Invoices & receipts */}
          {portal.invoices.length > 0 && (
            <section className="card">
              <h3 className="mb-2 flex items-center gap-2 font-display text-headline-sm text-text">
                <FileText className="size-4" aria-hidden="true" /> Invoices &amp; receipts
              </h3>
              <div className="divide-rows">
                {portal.invoices.map((inv) => (
                  <div key={inv.invoiceId} className="list-row !px-1">
                    <Link
                      className="min-w-0 flex-1 font-mono text-body-md text-primary hover:underline"
                      href={`/book/${orgSlug}/invoice/${inv.invoiceId}?ref=${encodeURIComponent(
                        query.reference,
                      )}&contact=${encodeURIComponent(query.contact)}`}
                    >
                      {inv.number}
                    </Link>
                    <span className="font-mono text-body-md text-text-muted">
                      {formatKes(inv.totalCents)}
                    </span>
                    <Link
                      href={`/book/${orgSlug}/invoice/${inv.invoiceId}?ref=${encodeURIComponent(
                        query.reference,
                      )}&contact=${encodeURIComponent(query.contact)}`}
                    >
                      <Button size="sm" variant="ghost">
                        Open
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Requests */}
          <section className="card space-y-3">
            <h3 className="flex items-center gap-2 font-display text-headline-sm text-text">
              <ConciergeBell className="size-4" aria-hidden="true" /> Need something?
            </h3>
            {portal.requests.length > 0 && (
              <div className="divide-rows">
                {portal.requests.map((r, i) => (
                  <div key={i} className="list-row !px-1">
                    <p className="min-w-0 flex-1 text-body-md text-text">“{r.message}”</p>
                    <StatusChip status={r.status === "resolved" ? "success" : "info"}>
                      {r.status}
                    </StatusChip>
                  </div>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setRequestNote(null);
                try {
                  await submitRequest({
                    reference: query.reference,
                    contact: query.contact,
                    message,
                  });
                  setMessage("");
                  setRequestNote("Sent — the team will follow up.");
                } catch (err) {
                  setRequestNote(String((err as Error).message ?? err));
                }
              }}
            >
              <Input
                aria-label="Request message"
                placeholder="e.g. late check-in, extra towels…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={!message.trim()}>
                <Send className="size-4" aria-hidden="true" /> Send
              </Button>
            </form>
            {requestNote && <p className="text-body-md text-primary">{requestNote}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
