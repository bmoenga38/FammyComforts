"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes, kesToCents } from "@/lib/money";
import { Button, Card, CardContent, Input, StatusChip } from "@/components/ui";

/**
 * Guest portal (Stories 4.8 + 5.7): verified by reference + the phone/email
 * used to book. Shows status, derived balance, payments, invoices/receipts
 * (print views), a request box, and M-Pesa STK payment initiation (5.3).
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

  return (
    <main className="mx-auto max-w-lg space-y-6 p-4 md:p-8">
      <Link href={`/book/${orgSlug}`} className="text-sm text-fg-muted underline">
        ← All rooms
      </Link>
      <header><p className="eyebrow mb-1">Guest portal</p><h1 className="hero-title font-display text-headline-lg">Find my booking</h1></header>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (reference && contact) setQuery({ reference, contact });
        }}
      >
        <Input
          aria-label="Booking reference"
          placeholder="Booking reference (BK-…)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          required
        />
        <Input
          aria-label="Phone or email"
          placeholder="Phone or email used to book"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
        />
        <Button type="submit">Look up</Button>
      </form>

      {query && portal === undefined && (
        <p className="text-sm text-fg-muted">Searching…</p>
      )}
      {query && portal === null && (
        <p className="text-sm text-fg-muted">
          No booking matches that reference and contact. Check both and try again.
        </p>
      )}

      {portal && query && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{portal.reference}</h2>
                <StatusChip
                  status={
                    portal.status === "cancelled" || portal.status === "no_show"
                      ? "danger"
                      : portal.status === "pending"
                        ? "warning"
                        : "success"
                  }
                >
                  {portal.status.replaceAll("_", " ")}
                </StatusChip>
              </div>
              <p className="text-sm">
                {portal.propertyName} · {portal.roomType} · Room {portal.roomNumber}
              </p>
              <p className="text-sm text-fg-muted">
                {portal.checkInDate} → {portal.checkOutDate} · {portal.guestName}
              </p>
              <p className="text-sm">
                Total {formatKes(portal.expectedTotalCents)} · Balance due{" "}
                <span className="font-medium">{formatKes(portal.balanceCents)}</span>
              </p>
            </CardContent>
          </Card>

          {portal.balanceCents > 0n && (
            <Card>
              <CardContent className="space-y-2">
                <h3 className="font-medium">Pay with M-Pesa</h3>
                <div className="flex flex-wrap gap-2">
                  <Input
                    aria-label="M-Pesa phone"
                    placeholder="07XX XXX XXX"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    className="w-full sm:w-44"
                  />
                  <Input
                    aria-label="Amount KES"
                    placeholder="Amount (KES)"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full sm:w-36"
                  />
                  <Button
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
                    {busy ? "Sending…" : "Send STK push"}
                  </Button>
                </div>
                {payNote && <p className="text-sm text-fg-muted">{payNote}</p>}
              </CardContent>
            </Card>
          )}

          {portal.payments.length > 0 && (
            <Card>
              <CardContent className="space-y-1">
                <h3 className="font-medium">Payments</h3>
                {portal.payments.map((p, i) => (
                  <p key={i} className="text-sm text-fg-muted">
                    {p.provider.replaceAll("_", " ")} · {formatKes(p.amountCents)} ·{" "}
                    {p.status}
                    {p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {portal.invoices.length > 0 && (
            <Card>
              <CardContent className="space-y-1">
                <h3 className="font-medium">Invoices & receipts</h3>
                {portal.invoices.map((inv) => (
                  <p key={inv.invoiceId} className="text-sm">
                    <Link
                      className="underline"
                      href={`/book/${orgSlug}/invoice/${inv.invoiceId}?ref=${encodeURIComponent(
                        query.reference,
                      )}&contact=${encodeURIComponent(query.contact)}`}
                    >
                      {inv.number}
                    </Link>{" "}
                    <span className="text-fg-muted">
                      · {formatKes(inv.totalCents)} · open to print / save as PDF
                    </span>
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-2">
              <h3 className="font-medium">Need something?</h3>
              {portal.requests.map((r, i) => (
                <p key={i} className="text-sm text-fg-muted">
                  “{r.message}” — {r.status}
                </p>
              ))}
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
                />
                <Button type="submit" disabled={!message.trim()}>
                  Send
                </Button>
              </form>
              {requestNote && <p className="text-sm text-fg-muted">{requestNote}</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
