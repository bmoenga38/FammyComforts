"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes } from "@/lib/money";
import { Button, Card, CardContent, Input, StatusChip, EmptyState } from "@/components/ui";

/**
 * Public room catalog (Stories 4.1 + 4.3). No account needed — the tenant is
 * the org slug in the URL (/book/[orgSlug]). With dates, cards show exact
 * multi-night totals (tax included) and availability for the full range.
 */
function Catalog() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const sp = useSearchParams();
  const [checkIn, setCheckIn] = useState(sp.get("in") ?? "");
  const [checkOut, setCheckOut] = useState(sp.get("out") ?? "");
  const [applied, setApplied] = useState<{ in: string; out: string } | null>(
    sp.get("in") && sp.get("out") ? { in: sp.get("in")!, out: sp.get("out")! } : null,
  );

  const data = useQuery(
    api.catalog.rooms,
    applied
      ? { orgSlug, checkIn: applied.in, checkOut: applied.out }
      : { orgSlug },
  );

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">
          {data?.propertyName ?? "Stay with us"}
        </h1>
        <p className="text-sm text-fg-muted">
          Browse rooms and book in minutes — no account needed.{" "}
          <Link href={`/book/${orgSlug}/lookup`} className="underline">
            Find my booking
          </Link>
        </p>
      </header>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (checkIn && checkOut) setApplied({ in: checkIn, out: checkOut });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-fg-muted">Check-in</span>
          <Input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-fg-muted">Check-out</span>
          <Input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-40"
          />
        </label>
        <Button type="submit">Search dates</Button>
        {applied && (
          <Button type="button" variant="ghost" onClick={() => setApplied(null)}>
            Clear
          </Button>
        )}
      </form>

      {data === undefined ? (
        <p className="text-sm text-fg-muted">Loading rooms…</p>
      ) : data.rooms.length === 0 ? (
        <EmptyState title="No rooms yet" description="This property hasn't listed rooms." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.rooms.map((r) => (
            <Card key={r.roomId}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium">
                      {r.typeName} · Room {r.number}
                    </h2>
                    <p className="text-sm text-fg-muted">
                      {r.branchName}
                      {r.location ? ` · ${r.location}` : ""} · sleeps {r.capacity}
                    </p>
                  </div>
                  <StatusChip status={r.available ? "success" : "warning"}>
                    {applied ? (r.available ? "Available" : "Booked") : r.status}
                  </StatusChip>
                </div>
                <p className="text-sm">
                  {r.nightlyCents !== null ? (
                    <>
                      <span className="font-semibold">
                        {formatKes(r.nightlyCents)}
                      </span>
                      /night
                      {r.totals && (
                        <span className="text-fg-muted">
                          {" "}
                          · {r.nights} nights = {formatKes(r.totals.totalCents)} incl. tax
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-fg-muted">Contact property for rates</span>
                  )}
                </p>
                <Link
                  href={`/book/${orgSlug}/${r.roomId}${
                    applied ? `?in=${applied.in}&out=${applied.out}` : ""
                  }`}
                  className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-on-primary"
                >
                  {r.available && applied ? "Book this room" : "View details"}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <Catalog />
    </Suspense>
  );
}
