"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes } from "@/lib/money";
import { Button, Input, StatusChip, EmptyState } from "@/components/ui";
import { Users } from "lucide-react";

/**
 * Public guest catalog (Stories 4.1 + 4.3) — the prototype's customer
 * search/book view (ui-samples/fammycomfort_pwa app.js V.search +
 * components.js roomCard): page hero, date-search card, scrolling type-filter
 * chips, then a staggered grid of room cards (media area with status badge,
 * mono room number, name, type · capacity, mono price + Book action).
 * Rooms have no photos in the backend yet — gradient placeholders stand in
 * (tracked on the gap list).
 */
type RoomCardData = {
  roomId: string;
  number: string;
  status: string;
  branchName: string;
  location: string | null;
  typeName: string;
  capacity: number;
  nightlyCents: bigint | null;
  available: boolean;
  nights: number | null;
  totals: { totalCents: bigint } | null;
};

const PHOTO_GRADIENTS = [
  "linear-gradient(135deg,#0d9488 0%,#134e4a 60%,#0b1326 100%)",
  "linear-gradient(135deg,#0ea5e9 0%,#1e3a8a 70%,#0b1326 100%)",
  "linear-gradient(135deg,#eab308 0%,#92400e 65%,#0b1326 100%)",
  "linear-gradient(135deg,#f43f5e 0%,#881337 65%,#0b1326 100%)",
];
const photoFor = (key: string) => {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PHOTO_GRADIENTS[Math.abs(h) % PHOTO_GRADIENTS.length];
};

function chipFor(
  r: RoomCardData,
  dated: boolean,
): { tone: "success" | "info" | "warning" | "danger"; label: string } {
  if (dated) return r.available ? { tone: "success", label: "Available" } : { tone: "warning", label: "Booked" };
  if (r.status === "available") return { tone: "success", label: "Available" };
  if (r.status === "occupied") return { tone: "info", label: "Occupied" };
  if (r.status === "maintenance" || r.status === "blocked") return { tone: "danger", label: "Unavailable" };
  return { tone: "warning", label: r.status.replaceAll("_", " ") };
}

function Catalog() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const sp = useSearchParams();
  const [checkIn, setCheckIn] = useState(sp.get("in") ?? "");
  const [checkOut, setCheckOut] = useState(sp.get("out") ?? "");
  const [applied, setApplied] = useState<{ in: string; out: string } | null>(
    sp.get("in") && sp.get("out") ? { in: sp.get("in")!, out: sp.get("out")! } : null,
  );
  const [type, setType] = useState("All");

  const data = useQuery(
    api.catalog.rooms,
    applied ? { orgSlug, checkIn: applied.in, checkOut: applied.out } : { orgSlug },
  );

  const types = useMemo(
    () => ["All", ...new Set((data?.rooms ?? []).map((r) => r.typeName))],
    [data],
  );
  const rooms = ((data?.rooms ?? []) as RoomCardData[]).filter(
    (r) => type === "All" || r.typeName === type,
  );
  const dateQuery = applied ? `?in=${applied.in}&out=${applied.out}` : "";

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <section className="fade-in">
        {/* pageHero (components.js): eyebrow + gradient headline + sub */}
        <header className="mb-6">
          <p className="eyebrow mb-2">{data?.propertyName ?? "Find a lounge"}</p>
          <h2 className="hero-title font-display text-headline-lg">Book your stay</h2>
          <p className="mt-1 text-body-lg text-text-muted">
            No account needed — reserve in minutes.{" "}
            <Link href={`/book/${orgSlug}/lookup`} className="text-primary underline">
              Find my booking
            </Link>
          </p>
        </header>

        {/* Date search card (V.search) */}
        <form
          className="card mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (checkIn && checkOut) setApplied({ in: checkIn, out: checkOut });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              Check-in
              <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
              Check-out
              <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                Search dates
              </Button>
              {applied && (
                <Button type="button" variant="ghost" onClick={() => setApplied(null)}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          {applied && (
            <p className="mt-3 text-sm text-text-muted">
              Availability for{" "}
              <span className="font-mono text-text">
                {applied.in} → {applied.out}
              </span>{" "}
              — prices include tax.
            </p>
          )}
        </form>

        {/* Type filter chips (V.search type-chips) */}
        <div className="hide-scroll mb-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Room type">
          {types.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={type === t}
              onClick={() => setType(t)}
              className={`btn whitespace-nowrap px-3.5 py-2 ${type === t ? "btn-primary" : "btn-ghost"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Room grid (components.js roomCard) */}
        {data === undefined ? (
          <p className="text-sm text-text-muted">Loading rooms…</p>
        ) : rooms.length === 0 ? (
          <EmptyState title="No rooms" description="No rooms match this filter yet." />
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => {
              const chip = chipFor(r, !!applied);
              return (
                <Link
                  key={r.roomId}
                  href={`/book/${orgSlug}/${r.roomId}${dateQuery}`}
                  className="card card-hover group block overflow-hidden p-0"
                >
                  <figure
                    className="relative m-0 aspect-[16/10] overflow-hidden"
                    style={{ background: photoFor(r.typeName + r.number) }}
                  >
                    <span className="absolute right-3 top-3">
                      <StatusChip status={chip.tone}>{chip.label}</StatusChip>
                    </span>
                    <span className="absolute bottom-2 left-4 font-hero text-4xl font-extrabold text-white/20 transition-transform duration-500 group-hover:scale-110">
                      {r.typeName.slice(0, 1)}
                    </span>
                  </figure>
                  <div className="px-5 pb-5 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-body-md text-text-muted">Room {r.number}</span>
                      <span className="flex items-center gap-1 text-body-md text-text-muted">
                        <Users className="size-3.5" aria-hidden="true" /> {r.capacity}
                      </span>
                    </div>
                    <h3 className="mt-1 font-display text-headline-sm text-text">
                      {r.typeName}
                    </h3>
                    <p className="mt-0.5 text-body-md text-text-muted">
                      {r.branchName}
                      {r.location ? ` · ${r.location}` : ""}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      {r.nightlyCents !== null ? (
                        <div>
                          <span className="font-mono text-headline-sm text-primary">
                            {formatKes(r.nightlyCents)}
                          </span>
                          <span className="text-body-md text-text-muted"> /night</span>
                          {r.totals && (
                            <p className="text-xs text-text-muted">
                              {r.nights} nights = {formatKes(r.totals.totalCents)} incl. tax
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-text-muted">Ask for rates</span>
                      )}
                      <span className="btn btn-primary px-3.5 py-2">Book</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
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
