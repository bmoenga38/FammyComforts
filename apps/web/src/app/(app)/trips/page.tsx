"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes } from "@/lib/money";
import { Button, EmptyState, StatusChip } from "@/components/ui";
import { Luggage } from "lucide-react";

/**
 * Customer Trips (prototype V.reservations): every booking tied to the
 * signed-in customer, newest stay first, with status, dates, balance, and a
 * Manage link into the portal. Backed by customerPortal.trips.
 */
export default function TripsPage() {
  const trips = useQuery(api.customerPortal.trips);
  const slug = process.env.NEXT_PUBLIC_DEMO_ORG_SLUG ?? "demo";

  if (trips === undefined) {
    return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  }

  const tone = (s: string) =>
    s === "cancelled" || s === "no_show"
      ? "danger"
      : s === "pending"
        ? "warning"
        : s === "checked_out"
          ? "info"
          : "success";

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">My stays</p>
        <h1 className="hero-title font-display text-headline-lg">Trips</h1>
        <p className="mt-1 text-body-lg text-text-muted">
          {trips.length} booking{trips.length === 1 ? "" : "s"} on your account
        </p>
      </header>

      {trips.length === 0 ? (
        <EmptyState
          icon={<Luggage className="size-6" aria-hidden="true" />}
          title="No trips yet"
          description="Book your first stay and it will appear here."
          action={
            <Link href="/book">
              <Button>Browse lounges</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {trips.map((t) => (
            <div key={t.reference} className="card flex flex-wrap items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-card bg-bg-input text-primary">
                <Luggage className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-headline-sm text-text">{t.roomType}</p>
                <p className="font-mono text-body-md text-text-muted">
                  {t.reference} · Rm {t.roomNumber} · {t.checkInDate} → {t.checkOutDate}
                </p>
              </div>
              <div className="text-right">
                <StatusChip status={tone(t.status)}>
                  {t.status.replaceAll("_", " ")}
                </StatusChip>
                <p className="mt-1 font-mono text-body-md text-text">{formatKes(t.totalCents)}</p>
                {t.balanceCents > 0n && (
                  <p className="font-mono text-[11px] text-warning">
                    {formatKes(t.balanceCents)} due
                  </p>
                )}
              </div>
              <Link href={`/book/${slug}/lookup`} className="w-full sm:w-auto">
                <Button variant="ghost" size="sm" fullWidth>
                  Manage
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
