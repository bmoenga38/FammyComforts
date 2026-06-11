"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes } from "@/lib/money";
import { Button, Card, CardContent, Input, StatusChip } from "@/components/ui";

/**
 * Guest booking lookup (Story 4.8): reference + the phone/email used to book.
 * The contact requirement prevents reference enumeration; the server returns
 * null for any mismatch (no different error for "wrong contact").
 */
export default function LookupPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [query, setQuery] = useState<{ reference: string; contact: string } | null>(
    null,
  );

  const result = useQuery(api.guestBookings.lookup, query ?? "skip");

  return (
    <main className="mx-auto max-w-lg space-y-6 p-4 md:p-8">
      <Link href={`/book/${orgSlug}`} className="text-sm text-fg-muted underline">
        ← All rooms
      </Link>
      <h1 className="font-display text-2xl font-semibold">Find my booking</h1>

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

      {query && result === undefined && (
        <p className="text-sm text-fg-muted">Searching…</p>
      )}
      {query && result === null && (
        <p className="text-sm text-fg-muted">
          No booking matches that reference and contact. Check both and try again.
        </p>
      )}
      {result && (
        <Card>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{result.reference}</h2>
              <StatusChip
                status={
                  result.status === "cancelled" || result.status === "no_show"
                    ? "danger"
                    : result.status === "pending"
                      ? "warning"
                      : "success"
                }
              >
                {result.status.replaceAll("_", " ")}
              </StatusChip>
            </div>
            <p className="text-sm">
              {result.propertyName} · {result.roomType} · Room {result.roomNumber}
            </p>
            <p className="text-sm text-fg-muted">
              {result.checkInDate} → {result.checkOutDate} · {result.guestName}
            </p>
            <p className="text-sm">
              Total {formatKes(result.expectedTotalCents)} · Balance due{" "}
              <span className="font-medium">{formatKes(result.balanceCents)}</span>
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
