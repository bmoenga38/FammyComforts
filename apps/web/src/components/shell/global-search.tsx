"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { Search, DoorClosed, UserRound, CalendarCheck } from "lucide-react";

/**
 * Top-bar global search. Queries `search.global` (org-scoped, permission-aware)
 * across rooms, guests, and bookings and shows grouped live results in a
 * portaled dropdown. Picking a result jumps to the front desk to act on it.
 * Non-functional placeholder no more — this is the real thing.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useQuery(
    api.search.global,
    text.trim().length >= 2 ? { text } : "skip",
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setText("");
    router.push(href);
  };

  const hasResults =
    !!results &&
    ((results.rooms?.length ?? 0) > 0 ||
      (results.guests?.length ?? 0) > 0 ||
      (results.bookings?.length ?? 0) > 0);
  const showPanel = open && text.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <label className="hidden items-center gap-2 rounded-ctrl border border-border bg-bg-input px-3 py-2 text-sm text-text-muted focus-within:border-primary sm:flex">
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Search bookings, guests, rooms</span>
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search bookings, guests, rooms"
          className="w-40 bg-transparent text-text placeholder:text-text-muted focus:outline-none lg:w-52"
        />
      </label>

      {showPanel &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Close search"
              className="fixed inset-0 z-[90] cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              role="region"
              aria-label="Search results"
              className="fade-in fixed right-3 top-16 z-[91] max-h-[75vh] w-[calc(100vw-1.5rem)] overflow-y-auto rounded-card border border-[var(--hairline)] bg-bg-card p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:right-6 sm:w-[420px]"
            >
              {results === undefined ? (
                <p className="px-3 py-4 text-body-md text-text-muted">Searching…</p>
              ) : !hasResults ? (
                <p className="px-3 py-4 text-body-md text-text-muted">
                  No matches for “{text.trim()}”.
                </p>
              ) : (
                <div className="space-y-1">
                  {results.bookings.length > 0 && (
                    <Group label="Bookings">
                      {results.bookings.map((b) => (
                        <ResultRow
                          key={b.bookingId}
                          icon={<CalendarCheck className="size-4" />}
                          tone="bg-badge-info text-badge-info-fg"
                          title={`${b.reference} · ${b.guestName}`}
                          sub={`${b.roomNumber ? `Rm ${b.roomNumber} · ` : ""}${b.checkInDate} → ${b.checkOutDate} · ${b.status}`}
                          onClick={() => go("/front-desk")}
                        />
                      ))}
                    </Group>
                  )}
                  {results.guests.length > 0 && (
                    <Group label="Guests">
                      {results.guests.map((g) => (
                        <ResultRow
                          key={g.guestId}
                          icon={<UserRound className="size-4" />}
                          tone="bg-badge-success text-badge-success-fg"
                          title={g.fullName}
                          sub={[g.phone, g.email].filter(Boolean).join(" · ")}
                          onClick={() => go("/front-desk")}
                        />
                      ))}
                    </Group>
                  )}
                  {results.rooms.length > 0 && (
                    <Group label="Rooms">
                      {results.rooms.map((r) => (
                        <ResultRow
                          key={r.roomId}
                          icon={<DoorClosed className="size-4" />}
                          tone="bg-badge-warning text-badge-warning-fg"
                          title={`Room ${r.number} · ${r.typeName}`}
                          sub={r.status}
                          onClick={() => go("/front-desk")}
                        />
                      ))}
                    </Group>
                  )}
                </div>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-label-caps px-3 pb-1 pt-2 uppercase text-text-muted">{label}</p>
      {children}
    </div>
  );
}

function ResultRow({
  icon,
  tone,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="list-row w-full !px-3 !py-2.5 text-left transition-colors hover:bg-bg-input"
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text">{title}</span>
        {sub && <span className="block truncate text-body-md text-text-muted">{sub}</span>}
      </span>
    </button>
  );
}
