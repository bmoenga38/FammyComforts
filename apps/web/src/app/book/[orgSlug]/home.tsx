"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { formatKes } from "@/lib/money";
import { roomImage, roomGradient, HERO_IMAGE } from "@/lib/room-images";
import { StatusChip } from "@/components/ui";
import {
  Users,
  Search,
  LogIn,
  Menu,
  X,
  Clock4,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  MapPin,
  ArrowRight,
  LayoutGrid,
} from "lucide-react";

/**
 * PUBLIC landing page for a property (`/book/[orgSlug]`, no app shell).
 *
 * Layout follows the agreed marketing skeleton — sticky nav, hero, booking
 * strip, room grid, benefits, about, location, CTA, footer — but every colour,
 * typeface and class comes from the Fammy Comforts design system in
 * `globals.css` (Syne / Space Grotesk / Inter / JetBrains Mono, navy + teal).
 * Nothing here is styled by the skeleton's own CSS.
 *
 * The room grid shows the FIRST SIX rooms from the database in a 2 × 3 grid.
 * Every remaining room lives behind sign-in, in the customer dashboard
 * (`/browse`, which renders `./catalog` in-shell with no cap) — so the public
 * page stays a shop window and the full inventory stays with account holders.
 *
 * Prices are deliberately NOT printed on the card: each card carries a
 * "View price" control that reveals the nightly rate in place.
 */

/** Only the fields this page renders — `api.catalog.rooms` returns more. */
type RoomCard = {
  roomId: string;
  number: string;
  status: string;
  coverImage: string | null;
  branchName: string;
  location: string | null;
  typeName: string;
  capacity: number;
  nightlyCents: bigint | null;
  available: boolean;
};

/** How many rooms the public page shows. Two rows of three. */
const PUBLIC_ROOM_LIMIT = 6;

function chipFor(r: RoomCard): { tone: "success" | "info" | "warning" | "danger"; label: string } {
  if (r.status === "available") return { tone: "success", label: "Available" };
  if (r.status === "occupied") return { tone: "info", label: "Occupied" };
  if (r.status === "maintenance" || r.status === "blocked") {
    return { tone: "danger", label: "Unavailable" };
  }
  return { tone: "warning", label: r.status.replaceAll("_", " ") };
}

const NAV_LINKS = [
  { href: "#rooms", label: "Rooms" },
  { href: "#about", label: "About" },
  { href: "#location", label: "Location" },
];

const BENEFITS = [
  {
    icon: Clock4,
    title: "Flexible check-in",
    body: "Arrive and leave around your stay, not around a rota.",
  },
  {
    icon: ShieldCheck,
    title: "Private & peaceful",
    body: "Quiet, self-contained spaces built for real rest.",
  },
  {
    icon: Sparkles,
    title: "Spotless housekeeping",
    body: "Every room is cleaned and checked before you arrive.",
  },
  {
    icon: UtensilsCrossed,
    title: "Food & drinks",
    body: "Order to your room from the kitchen once you're booked in.",
  },
];

export function Home() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const { isAuthenticated } = useConvexAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  /** Room ids whose nightly rate the visitor has asked to see. */
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  const data = useQuery(api.catalog.rooms, { orgSlug });
  const allRooms = (data?.rooms ?? []) as RoomCard[];
  const shown = allRooms.slice(0, PUBLIC_ROOM_LIMIT);
  const propertyName = data?.propertyName ?? "Fammy Comforts";

  /**
   * Login-aware destination. Signed in → straight there. Signed out → the
   * sign-in gate carrying `next`, so the visitor lands back on exactly the
   * page they tapped instead of a generic home.
   */
  const go = (path: string) =>
    isAuthenticated ? path : `/signin?next=${encodeURIComponent(path)}`;

  /** Booking flow for one specific room. */
  const bookHref = (roomId: string) => go(`/book/${orgSlug}/${roomId}`);
  /** The signed-in catalog, where the rooms beyond the first six live. */
  const allRoomsHref = go("/browse");

  const branches = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const r of allRooms) if (!seen.has(r.branchName)) seen.set(r.branchName, r.location);
    return [...seen].map(([name, location]) => ({ name, location }));
  }, [allRooms]);

  const mapQuery = branches.find((b) => b.location)?.location ?? propertyName;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  return (
    <main className="fade-in">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="glass-bar sticky top-0 z-50 border-b border-border">
        <div className="mx-auto flex min-h-[72px] w-full max-w-6xl items-center justify-between gap-6 px-4 md:px-6">
          <Link href={`/book/${orgSlug}`} className="flex items-center gap-2.5">
            <span className="brand-mark grid size-9 text-[15px]">F</span>
            <span className="font-hero text-sm font-extrabold uppercase tracking-[0.06em] text-text">
              {propertyName}
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-body-md text-text-muted transition-colors hover:text-primary"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link href={`/book/${orgSlug}/lookup`} className="btn btn-ghost px-3.5 py-2">
              <Search className="size-4" aria-hidden="true" /> Find my booking
            </Link>
            {isAuthenticated ? (
              <Link href="/browse" className="btn btn-primary px-3.5 py-2">
                <LayoutGrid className="size-4" aria-hidden="true" /> My dashboard
              </Link>
            ) : (
              <Link href="/signin" className="btn btn-primary px-3.5 py-2">
                <LogIn className="size-4" aria-hidden="true" /> Sign in
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="icon-btn md:hidden"
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="public-mobile-nav"
            aria-label="Main"
            className="grid gap-3 border-t border-border px-4 py-4 md:hidden"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-body-md text-text-muted"
              >
                {l.label}
              </a>
            ))}
            <Link href={`/book/${orgSlug}/lookup`} className="text-body-md text-text-muted">
              Find my booking
            </Link>
            <Link
              href={isAuthenticated ? "/browse" : "/signin"}
              className="text-body-md font-semibold text-primary"
            >
              {isAuthenticated ? "My dashboard" : "Sign in"}
            </Link>
          </nav>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        id="home"
        className="relative grid min-h-[520px] place-items-center overflow-hidden text-center"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(rgba(11,19,38,0.78),rgba(11,19,38,0.95))]"
        />
        <div className="relative mx-auto w-full max-w-2xl px-5 py-20">
          <p className="eyebrow mb-3">{propertyName} · Nairobi</p>
          <h1 className="hero-title mx-auto font-hero text-hero-display">
            More than a stay.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-body-lg text-text-muted">
            A private place to rest, sleep and recharge — comfortable rooms,
            real privacy, and stays that flex around you.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <a href="#rooms" className="btn btn-primary">
              View rooms
            </a>
            <a href="#location" className="btn btn-ghost">
              <MapPin className="size-4" aria-hidden="true" /> Find us
            </a>
          </div>
        </div>
      </section>

      {/* ── Booking strip ───────────────────────────────────────────────── */}
      <section className="border-y border-border bg-bg-alt">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div>
            <h2 className="font-display text-headline-sm text-text">Ready to book?</h2>
            <p className="text-body-md text-text-muted">
              Pick a room below — dates are chosen during booking.
            </p>
          </div>
          <Link href={allRoomsHref} className="btn btn-primary w-full sm:w-auto">
            Start booking <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── Rooms: six, straight from the database ──────────────────────── */}
      <section id="rooms" className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-2">Stay your way</p>
            <h2 className="font-display text-headline-lg text-text">Rooms &amp; suites</h2>
          </div>
          <p className="max-w-sm text-body-md text-text-muted">
            Choose a space, see the rate, and continue to secure your stay.
          </p>
        </div>

        {data === undefined ? (
          <p className="text-body-md text-text-muted">Loading rooms…</p>
        ) : shown.length === 0 ? (
          <div className="card text-center">
            <p className="text-body-md text-text-muted">
              No rooms are published yet. Please check back shortly.
            </p>
          </div>
        ) : (
          <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              const chip = chipFor(r);
              const isRevealed = revealed.has(r.roomId);
              return (
                <article key={r.roomId} className="card card-hover group overflow-hidden p-0">
                  <figure
                    className="relative m-0 aspect-[16/10] overflow-hidden"
                    style={{ background: roomGradient(r.typeName + r.number) }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.coverImage ?? roomImage(r.typeName + r.number)}
                      alt={`${r.typeName} — room ${r.number}`}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,19,38,0.55),transparent_55%)]"
                    />
                    <span className="absolute right-3 top-3">
                      <StatusChip status={chip.tone}>{chip.label}</StatusChip>
                    </span>
                  </figure>

                  <div className="px-5 pb-5 pt-4">
                    <p className="eyebrow font-mono">Room {r.number}</p>
                    <h3 className="mt-1.5 font-display text-headline-sm text-text">
                      {r.typeName}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-body-md text-text-muted">
                      {r.branchName}
                      {r.location ? ` · ${r.location}` : ""}
                      <span className="ml-auto inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden="true" /> {r.capacity}
                      </span>
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                      {/* Price is revealed on request, never printed up front. */}
                      {isRevealed ? (
                        r.nightlyCents !== null ? (
                          <span className="font-mono text-headline-sm text-primary">
                            {formatKes(r.nightlyCents)}
                            <span className="text-body-md font-sans text-text-muted"> /night</span>
                          </span>
                        ) : (
                          <span className="text-body-md text-text-muted">Ask for rates</span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealed((prev) => new Set(prev).add(r.roomId))
                          }
                          className="btn btn-ghost px-3 py-1.5"
                        >
                          View price
                        </button>
                      )}
                      <Link href={bookHref(r.roomId)} className="btn btn-primary px-3.5 py-2">
                        Book now
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {allRooms.length > PUBLIC_ROOM_LIMIT && (
          <div className="mt-8 text-center">
            <Link href={allRoomsHref} className="btn btn-ghost">
              See all {allRooms.length} rooms
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p className="mt-2 text-body-md text-text-muted">
              {isAuthenticated
                ? "The full list is in your dashboard."
                : "Sign in to browse the full list in your dashboard."}
            </p>
          </div>
        )}
      </section>

      {/* ── Benefits ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 md:pb-20">
        <div className="mb-8">
          <p className="eyebrow mb-2">The Fammy experience</p>
          <h2 className="font-display text-headline-lg text-text">
            Comfort without compromise.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card card-pad-sm">
              <span className="kpi-icon mb-4 bg-badge-success text-badge-success-fg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-headline-sm text-text">{title}</h3>
              <p className="mt-1.5 text-body-md text-text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────────────── */}
      <section
        id="about"
        className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 md:grid-cols-2 md:px-6 md:pb-20"
      >
        <figure
          className="relative m-0 min-h-[320px] overflow-hidden rounded-card border border-border"
          style={{ background: roomGradient(propertyName) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roomImage(propertyName)}
            alt={`Inside ${propertyName}`}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </figure>
        <div>
          <p className="eyebrow mb-2">{propertyName}</p>
          <h2 className="font-display text-headline-lg text-text">
            A private place to rest, sleep and recharge.
          </h2>
          <p className="mt-4 text-body-lg text-text-muted">
            {propertyName} offers private, comfortable rooms for guests who
            value quiet, convenience and flexibility — whether that is a few
            hours between meetings or a full night&apos;s stay.
          </p>
          <p className="mt-3 text-body-lg text-text-muted">
            Book online in minutes, pay how you prefer, and manage everything —
            your stay, your payments, even room service — from your account.
          </p>
          <a href="#rooms" className="btn btn-primary mt-6">
            Explore rooms
          </a>
        </div>
      </section>

      {/* ── Location ────────────────────────────────────────────────────── */}
      <section
        id="location"
        className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-16 md:grid-cols-[0.8fr_1.2fr] md:px-6 md:pb-20"
      >
        <div className="card">
          <p className="eyebrow mb-2">Come find us</p>
          <h2 className="font-display text-headline-md text-text">{propertyName}</h2>
          {branches.length === 0 ? (
            <p className="mt-4 text-body-md text-text-muted">
              Location details are published with each room.
            </p>
          ) : (
            <div className="mt-5 grid gap-2.5">
              {branches.map((b) => (
                <div key={b.name} className="rounded-ctrl border border-border px-4 py-3">
                  <p className="text-label-caps uppercase text-primary">{b.name}</p>
                  <p className="mt-1 text-body-md text-text">
                    {b.location ?? "Address available on booking"}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Link href={`/book/${orgSlug}/lookup`} className="btn btn-ghost mt-5 w-full">
            <Search className="size-4" aria-hidden="true" /> Find my booking
          </Link>
        </div>

        <div className="overflow-hidden rounded-card border border-border">
          <iframe
            src={mapSrc}
            title={`Map showing ${mapQuery}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="block min-h-[360px] w-full border-0"
          />
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full rounded-none"
          >
            Open in Google Maps
          </a>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-bg-alt px-4 py-16 text-center md:py-20">
        <p className="eyebrow mb-3">Privacy. Comfort. Rest.</p>
        <h2 className="mx-auto font-display text-headline-lg text-text">
          Ready to rest, sleep &amp; recharge?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-body-lg text-text-muted">
          Choose your room and continue to booking.
        </p>
        <Link href={allRoomsHref} className="btn btn-primary mt-6">
          Book your stay <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-bg-deep px-4 pt-12 md:px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-8 pb-9 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link href={`/book/${orgSlug}`} className="mb-4 flex items-center gap-2.5">
              <span className="brand-mark grid size-9 text-[15px]">F</span>
              <span className="font-hero text-sm font-extrabold uppercase tracking-[0.06em] text-text">
                {propertyName}
              </span>
            </Link>
            <p className="text-body-md text-text-muted">
              Executive lounge &amp; overnight suites — a private space to rest,
              sleep and recharge.
            </p>
          </div>

          <div>
            <h3 className="text-label-caps mb-4 uppercase text-text">Explore</h3>
            <nav className="grid gap-2.5" aria-label="Footer">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="w-fit text-body-md text-text-muted transition-colors hover:text-primary"
                >
                  {l.label}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-label-caps mb-4 uppercase text-text">Booking</h3>
            <nav className="grid gap-2.5" aria-label="Booking">
              <Link
                href={isAuthenticated ? "/browse" : "/signin"}
                className="w-fit text-body-md text-text-muted transition-colors hover:text-primary"
              >
                {isAuthenticated ? "My dashboard" : "Sign in"}
              </Link>
              <Link
                href={allRoomsHref}
                className="w-fit text-body-md text-text-muted transition-colors hover:text-primary"
              >
                Book your stay
              </Link>
              <Link
                href={`/book/${orgSlug}/lookup`}
                className="w-fit text-body-md text-text-muted transition-colors hover:text-primary"
              >
                Find my booking
              </Link>
            </nav>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl border-t border-border py-5">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} {propertyName}. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
