"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes } from "@/lib/money";
import { roomImage, roomGradient } from "@/lib/room-images";
import { Button, EmptyState } from "@/components/ui";
import { Search, QrCode, Zap, Users } from "lucide-react";

/**
 * Customer home (prototype V.home): "Karibu · {tier} member" welcome header,
 * an active-reservation card with View QR / Manage, and a featured-lounges
 * grid — all from the signed-in customer's real data (customerPortal.summary).
 */
export default function CustomerHomePage() {
  const data = useQuery(api.customerPortal.summary);

  if (data === undefined) {
    return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  }

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();
  const firstName = data.name.split(/\s+/)[0];

  return (
    <section className="fade-in space-y-6 p-4 md:p-6">
      {/* Welcome header (prototype pageHero) */}
      <header>
        <p className="eyebrow mb-1">Karibu · {data.tier} member</p>
        <h1 className="hero-title font-display text-headline-lg">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-1 text-body-lg text-text-muted">
          Find a lounge that feels like home.
        </p>
      </header>

      {/* Search → public catalog */}
      <Link
        href="/book"
        className="flex items-center gap-3 rounded-card border border-border bg-bg-input px-4 py-3 text-text-muted transition-colors hover:border-border-focus"
      >
        <Search className="size-5 shrink-0" aria-hidden="true" />
        Search lounges, dates, guests…
      </Link>

      {/* Active reservation */}
      {data.activeReservation ? (
        <div className="card relative overflow-hidden !bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_70%)]">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-badge-success px-2.5 py-1 text-xs font-bold text-badge-success-fg">
            <Zap className="size-3.5" aria-hidden="true" /> Active reservation
          </span>
          <h2 className="font-display text-headline-md text-text">
            {data.activeReservation.roomType}
          </h2>
          <p className="mt-1 font-mono text-body-md text-text-muted">
            {data.activeReservation.reference} · Rm {data.activeReservation.roomNumber} ·
            Check-in {data.activeReservation.checkInDate}
          </p>
          {data.activeReservation.balanceCents > 0n && (
            <p className="mt-1 text-body-md text-warning">
              Balance due {formatKes(data.activeReservation.balanceCents)}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={`/book/${data.orgSlug}/lookup`}>
              <Button>
                <QrCode className="size-4" aria-hidden="true" /> View QR
              </Button>
            </Link>
            <Link href={`/book/${data.orgSlug}/lookup`}>
              <Button variant="ghost">Manage</Button>
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No active reservation"
          description="Book a lounge and your stay will show up here."
          action={
            <Link href="/book">
              <Button>Browse lounges</Button>
            </Link>
          }
        />
      )}

      {/* Featured lounges */}
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="font-display text-headline-sm text-text">Featured lounges</h2>
            <p className="text-body-md text-text-muted">Handpicked for you</p>
          </div>
          <Link href="/book">
            <Button size="sm" variant="ghost">
              View all
            </Button>
          </Link>
        </div>
        {data.featured.length === 0 ? (
          <p className="text-body-md text-text-muted">No lounges published yet.</p>
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.featured.map((r) => (
              <Link
                key={r.roomId}
                href={`/book/${data.orgSlug}/${r.roomId}`}
                className="card card-hover group block overflow-hidden p-0"
              >
                <figure
                  className="relative m-0 aspect-[16/10] overflow-hidden"
                  style={{ background: roomGradient(r.roomType + r.number) }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={roomImage(r.roomType + r.number)}
                    alt={`${r.roomType} lounge`}
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,19,38,0.55),transparent_55%)]" />
                </figure>
                <div className="px-4 pb-4 pt-3">
                  <h3 className="font-display text-headline-sm text-text">{r.roomType}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-body-md text-text-muted">
                    <Users className="size-3.5" aria-hidden="true" /> {r.capacity} guests
                  </p>
                  {r.nightlyCents !== null && (
                    <p className="mt-2 font-mono text-headline-sm text-primary">
                      {formatKes(r.nightlyCents)}
                      <span className="text-body-md text-text-muted"> /night</span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
