"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { Id } from "@fammycomforts/backend/convex/_generated/dataModel";
import { usePermissions } from "@/lib/use-permissions";
import { formatKes, kesToCents } from "@/lib/money";
import {
  Button,
  Card,
  CardContent,
  Input,
  StatusChip,
  EmptyState,
} from "@/components/ui";

/**
 * Front Desk workspace (Epic 6): Today board with the full booking lifecycle
 * (confirm → check-in → payments → check-out w/ asset check), a 14-day
 * availability calendar, walk-in/phone booking creation, and guest profiles.
 * Server enforces every permission; this only gates affordances.
 */
type Tab = "today" | "calendar" | "new" | "guests";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FrontDeskPage() {
  const { can, isLoading } = usePermissions();
  const [tab, setTab] = useState<Tab>("today");

  if (isLoading) return <p className="p-6 text-sm text-fg-muted">Loading…</p>;
  if (!can("Bookings", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have front-desk permissions." />
      </div>
    );
  }
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "today", label: "Today", show: true },
    { id: "calendar", label: "Calendar", show: true },
    { id: "new", label: "New booking", show: can("Bookings", "write") },
    { id: "guests", label: "Guests", show: can("Guests", "read") },
  ];
  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Front Desk</h1>
      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              variant={tab === t.id ? "primary" : "ghost"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
      </div>
      {tab === "today" && (
        <TodayBoard canWrite={can("Bookings", "write")} canPay={can("Payments", "write")} />
      )}
      {tab === "calendar" && <CalendarGrid />}
      {tab === "new" && can("Bookings", "write") && <NewBooking />}
      {tab === "guests" && can("Guests", "read") && (
        <GuestsSection canWrite={can("Guests", "write")} />
      )}
    </div>
  );
}

// ---------- Today board (6.1, 6.4–6.8) ----------

type BoardRow = {
  bookingId: Id<"bookings">;
  reference: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  roomNumber: string;
  balanceCents: bigint;
};

function TodayBoard({ canWrite, canPay }: { canWrite: boolean; canPay: boolean }) {
  const [date, setDate] = useState(todayIso());
  const board = useQuery(api.deskBookings.board, { date });

  if (board === undefined) return <p className="text-sm text-fg-muted">Loading board…</p>;

  const sections: { title: string; rows: BoardRow[] }[] = [
    { title: "Pending (website)", rows: board.pending },
    { title: "Arrivals", rows: board.arrivals },
    { title: "In-house", rows: board.inHouse },
    { title: "Departures today", rows: board.departures },
  ];

  return (
    <div className="space-y-4">
      <label className="text-sm">
        <span className="mb-1 block text-fg-muted">Board date</span>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
      </label>
      {sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="font-medium">{s.title}</h2>
          {s.rows.length === 0 ? (
            <p className="text-sm text-fg-muted">None.</p>
          ) : (
            s.rows.map((b) => (
              <BookingCard
                key={`${s.title}-${b.bookingId}`}
                b={b}
                canWrite={canWrite}
                canPay={canPay}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
}

function BookingCard({
  b,
  canWrite,
  canPay,
}: {
  b: BoardRow;
  canWrite: boolean;
  canPay: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const confirm = useMutation(api.deskBookings.confirm);
  const checkIn = useMutation(api.deskBookings.checkIn);
  const checkOut = useMutation(api.deskBookings.checkOut);
  const extend = useMutation(api.deskBookings.extend);
  const cancel = useMutation(api.deskBookings.cancel);
  const markNoShow = useMutation(api.deskBookings.markNoShow);
  const refund = useMutation(api.deskBookings.refund);
  const recordManual = useMutation(api.payments.recordManual);
  const generateInvoice = useMutation(api.invoices.generate);

  const [idVerified, setIdVerified] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "mpesa_manual" | "card">("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payReceipt, setPayReceipt] = useState("");
  const [assetOk, setAssetOk] = useState(true);
  const [damageNotes, setDamageNotes] = useState("");
  const [damageAmount, setDamageAmount] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [extendDate, setExtendDate] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const run = (p: Promise<unknown>, ok: string) => {
    setNote(null);
    p.then(() => setNote(ok)).catch((e) => setNote(String(e.message ?? e)));
  };

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-sm font-semibold">{b.reference}</span>{" "}
            <span className="text-sm">
              {b.guestName} · Room {b.roomNumber} · {b.checkInDate} → {b.checkOutDate}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip
              status={
                b.status === "checked_in"
                  ? "info"
                  : b.status === "pending"
                    ? "warning"
                    : "success"
              }
            >
              {b.status.replaceAll("_", " ")}
            </StatusChip>
            <span
              className={`text-sm ${b.balanceCents > 0n ? "font-medium" : "text-fg-muted"}`}
            >
              {formatKes(b.balanceCents)} due
            </span>
            {canWrite && (
              <Button variant="ghost" onClick={() => setOpen(!open)}>
                {open ? "Close" : "Actions"}
              </Button>
            )}
          </div>
        </div>

        {open && canWrite && (
          <div className="space-y-3 border-t border-border pt-3 text-sm">
            {b.status === "pending" && (
              <Button onClick={() => run(confirm({ bookingId: b.bookingId }), "Confirmed.")}>
                Confirm booking
              </Button>
            )}

            {b.status === "confirmed" && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={idVerified}
                    onChange={(e) => setIdVerified(e.target.checked)}
                  />
                  ID verified
                </label>
                <Button
                  onClick={() =>
                    run(checkIn({ bookingId: b.bookingId, idVerified }), "Checked in.")
                  }
                >
                  Check in
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    run(markNoShow({ bookingId: b.bookingId }), "Marked no-show.")
                  }
                >
                  No-show
                </Button>
              </div>
            )}

            {canPay && (b.status === "confirmed" || b.status === "checked_in") && (
              <div className="flex flex-wrap items-end gap-2">
                <label>
                  <span className="mb-1 block text-fg-muted">Record payment</span>
                  <select
                    aria-label="Payment method"
                    className="rounded-lg border border-border bg-bg-input px-2 py-2"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  >
                    <option value="cash">cash</option>
                    <option value="mpesa_manual">M-Pesa (manual ref)</option>
                    <option value="card">card</option>
                  </select>
                </label>
                <Input
                  aria-label="Payment amount KES"
                  placeholder="KES"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-28"
                />
                {payMethod === "mpesa_manual" && (
                  <Input
                    aria-label="M-Pesa receipt"
                    placeholder="Receipt code"
                    value={payReceipt}
                    onChange={(e) => setPayReceipt(e.target.value)}
                    className="w-36"
                  />
                )}
                <Button
                  onClick={() =>
                    run(
                      recordManual({
                        bookingId: b.bookingId,
                        provider: payMethod,
                        amountCents: kesToCents(payAmount),
                        receiptNumber: payReceipt || undefined,
                      }),
                      "Payment recorded.",
                    )
                  }
                >
                  Record
                </Button>
              </div>
            )}

            {b.status === "checked_in" && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="font-medium">Check out</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={assetOk}
                    onChange={(e) => setAssetOk(e.target.checked)}
                  />
                  Assets verified OK
                </label>
                {!assetOk && (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      aria-label="Damage notes"
                      placeholder="Damage notes"
                      value={damageNotes}
                      onChange={(e) => setDamageNotes(e.target.value)}
                      className="w-52"
                    />
                    <Input
                      aria-label="Damage charge KES"
                      placeholder="Charge KES"
                      value={damageAmount}
                      onChange={(e) => setDamageAmount(e.target.value)}
                      className="w-28"
                    />
                  </div>
                )}
                {b.balanceCents > 0n && (
                  <Input
                    aria-label="Balance exception reason"
                    placeholder="Exception reason (required if balance unpaid)"
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      run(
                        checkOut({
                          bookingId: b.bookingId,
                          balanceException: exceptionReason
                            ? { reason: exceptionReason }
                            : undefined,
                          assetCheck: {
                            ok: assetOk,
                            notes: damageNotes || undefined,
                            damageChargeCents:
                              !assetOk && damageAmount
                                ? kesToCents(damageAmount)
                                : undefined,
                          },
                        }),
                        "Checked out — housekeeping queued.",
                      )
                    }
                  >
                    Complete check-out
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      run(
                        generateInvoice({ bookingId: b.bookingId, isReceipt: true }),
                        "Receipt generated (visible in the guest portal).",
                      )
                    }
                  >
                    Issue receipt
                  </Button>
                </div>
              </div>
            )}

            {(b.status === "pending" ||
              b.status === "confirmed" ||
              b.status === "checked_in") && (
              <div className="flex flex-wrap items-end gap-2">
                <label>
                  <span className="mb-1 block text-fg-muted">Extend to</span>
                  <Input
                    type="date"
                    aria-label="New check-out date"
                    value={extendDate}
                    onChange={(e) => setExtendDate(e.target.value)}
                    className="w-40"
                  />
                </label>
                <Button
                  variant="ghost"
                  onClick={() =>
                    run(
                      extend({ bookingId: b.bookingId, newCheckOutDate: extendDate }),
                      "Extended — charge posted.",
                    )
                  }
                >
                  Extend
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    run(
                      cancel({ bookingId: b.bookingId, reason: "Desk cancellation" }),
                      "Cancelled.",
                    )
                  }
                >
                  Cancel booking
                </Button>
                {canPay && (
                  <>
                    <Input
                      aria-label="Refund amount KES"
                      placeholder="Refund KES"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-28"
                    />
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(
                          refund({
                            bookingId: b.bookingId,
                            amountCents: kesToCents(refundAmount),
                            reason: "Desk refund",
                          }),
                          "Refund recorded (settle out-of-band).",
                        )
                      }
                    >
                      Refund
                    </Button>
                  </>
                )}
              </div>
            )}
            {note && <p className="text-fg-muted">{note}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Calendar (6.3) ----------

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function CalendarGrid() {
  const [from, setFrom] = useState(todayIso());
  const to = useMemo(() => addDays(from, 14), [from]);
  const grid = useQuery(api.calendar.grid, { from, to });
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(from, i)),
    [from],
  );

  if (grid === undefined) return <p className="text-sm text-fg-muted">Loading calendar…</p>;

  const cellFor = (room: (typeof grid)[number], day: string) => {
    const span = room.spans.find((s) => s.checkInDate <= day && s.checkOutDate > day);
    if (span) {
      return span.status === "checked_in"
        ? { label: "occ", cls: "bg-info/30" }
        : { label: "bkd", cls: "bg-warning/30" };
    }
    const checkout = room.spans.find((s) => s.checkOutDate === day);
    if (checkout) return { label: "out", cls: "bg-premium/30" };
    if (room.roomStatus === "dirty" || room.roomStatus === "cleaning") {
      return { label: "cln", cls: "bg-warning/20" };
    }
    if (room.roomStatus === "maintenance" || room.roomStatus === "blocked") {
      return { label: "blk", cls: "bg-danger/30" };
    }
    return { label: "", cls: "" };
  };

  return (
    <div className="space-y-3">
      <label className="text-sm">
        <span className="mb-1 block text-fg-muted">From</span>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-44"
        />
      </label>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-bg p-1 text-left">Room</th>
              {days.map((d) => (
                <th key={d} className="p-1 font-normal text-fg-muted">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((room) => (
              <tr key={room.roomId}>
                <td className="sticky left-0 bg-bg p-1 font-medium">
                  {room.number}{" "}
                  <span className="text-fg-muted">{room.typeName}</span>
                </td>
                {days.map((d) => {
                  const cell = cellFor(room, d);
                  return (
                    <td
                      key={d}
                      title={`${room.number} ${d}`}
                      className={`h-7 min-w-9 border border-border text-center ${cell.cls}`}
                    >
                      {cell.label}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-fg-muted">
        bkd = booked · occ = occupied · out = checkout day · cln = needs cleaning ·
        blk = blocked/maintenance
      </p>
    </div>
  );
}

// ---------- New booking (6.1) ----------

function NewBooking() {
  const guests = useQuery(api.guests.list, {});
  const rooms = useQuery(api.rooms.list, {});
  const create = useMutation(api.deskBookings.create);

  const [guestId, setGuestId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState(todayIso());
  const [checkOut, setCheckOut] = useState(addDays(todayIso(), 1));
  const [source, setSource] = useState<"walk_in" | "phone" | "direct" | "whatsapp">(
    "walk_in",
  );
  const [note, setNote] = useState<string | null>(null);

  if (guests === undefined || rooms === undefined) {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }

  return (
    <Card>
      <CardContent>
        <form
          className="space-y-3 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setNote(null);
            try {
              const res = await create({
                roomId: roomId as Id<"rooms">,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                guestId: guestId ? (guestId as Id<"guests">) : undefined,
                newGuest: guestId ? undefined : { fullName: newName, phone: newPhone },
                source,
                paymentMethod: "cash",
              });
              setNote(
                `Booked ${res.reference} — ${formatKes(res.expectedTotalCents)} expected.`,
              );
            } catch (err) {
              setNote(String((err as Error).message ?? err));
            }
          }}
        >
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Existing guest"
              className="rounded-lg border border-border bg-bg-input px-2 py-2"
              value={guestId}
              onChange={(e) => setGuestId(e.target.value)}
            >
              <option value="">New guest…</option>
              {guests.map((g) => (
                <option key={g.guestId} value={g.guestId}>
                  {g.fullName} ({g.phone})
                </option>
              ))}
            </select>
            {!guestId && (
              <>
                <Input
                  aria-label="Guest name"
                  placeholder="Guest name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-48"
                />
                <Input
                  aria-label="Guest phone"
                  placeholder="Phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-40"
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Room"
              className="rounded-lg border border-border bg-bg-input px-2 py-2"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
            >
              <option value="">Room…</option>
              {rooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.number} · {r.roomTypeName}
                </option>
              ))}
            </select>
            <Input
              type="date"
              aria-label="Check-in"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              aria-label="Check-out"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-40"
            />
            <select
              aria-label="Source"
              className="rounded-lg border border-border bg-bg-input px-2 py-2"
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="walk_in">walk-in</option>
              <option value="phone">phone</option>
              <option value="direct">direct</option>
              <option value="whatsapp">whatsapp</option>
            </select>
          </div>
          <Button type="submit">Create booking</Button>
          {note && <p className="text-fg-muted">{note}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

// ---------- Guests (6.2) ----------

function GuestsSection({ canWrite }: { canWrite: boolean }) {
  const [search, setSearch] = useState("");
  const guests = useQuery(api.guests.list, { search: search || undefined });
  const create = useMutation(api.guests.create);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (guests === undefined) return <p className="text-sm text-fg-muted">Loading…</p>;

  return (
    <Card>
      <CardContent className="space-y-3 text-sm">
        <Input
          aria-label="Search guests"
          placeholder="Search name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {guests.length === 0 ? (
          <p className="text-fg-muted">No guests found.</p>
        ) : (
          <ul className="space-y-1">
            {guests.map((g) => (
              <li key={g.guestId} className="flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-medium">{g.fullName}</span> · {g.phone}
                  {g.email ? ` · ${g.email}` : ""}
                </span>
                <span className="text-fg-muted">
                  {g.bookingCount} bookings · {formatKes(g.totalSpentCents)} spent
                </span>
              </li>
            ))}
          </ul>
        )}
        {canWrite && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create({ fullName: name, phone }).then(() => {
                setName("");
                setPhone("");
              });
            }}
          >
            <Input
              aria-label="New guest name"
              placeholder="New guest name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-48"
            />
            <Input
              aria-label="New guest phone"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-40"
            />
            <Button type="submit" disabled={!name || !phone}>
              Add guest
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
