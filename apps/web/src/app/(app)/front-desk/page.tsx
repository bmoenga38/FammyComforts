"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { Id } from "@fammycomforts/backend/convex/_generated/dataModel";
import { usePermissions } from "@/lib/use-permissions";
import { formatKes, kesToCents } from "@/lib/money";
import { Button, Input, StatusChip, EmptyState, Modal, ConfirmDialog } from "@/components/ui";
import {
  LogIn,
  LogOut,
  Hotel,
  CircleAlert,
  Wallet,
  ArrowRight,
  DoorOpen,
  CalendarDays,
  UserSearch,
  X,
} from "lucide-react";

/**
 * Front Desk workspace (Epic 6), presented per the reception views of the UI
 * prototype (ui-samples/fammycomfort_pwa app.js V.desk / V.calendar /
 * V.occupancy / V.lookup): KPI tiles + workflow strip + quick actions + the
 * arrivals/in-house boards, the room×date calendar grid (sticky room column,
 * today marker, tap-a-free-cell-to-book), the room board grouped by floor with
 * a right-docked one-tap status panel, and stat-card guest lookup. All actions
 * call the same Convex mutations as before — presentation only.
 */
type Tab = "today" | "calendar" | "rooms" | "new" | "guests";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function FrontDeskPage() {
  const { can, isLoading } = usePermissions();
  const [tab, setTab] = useState<Tab>("today");
  const [prefill, setPrefill] = useState<{ roomId: string; date: string } | null>(null);

  if (isLoading) return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  if (!can("Bookings", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have front-desk permissions." />
      </div>
    );
  }
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "today", label: "Desk", show: true },
    { id: "calendar", label: "Calendar", show: true },
    { id: "rooms", label: "Rooms", show: true },
    { id: "new", label: "New booking", show: can("Bookings", "write") },
    { id: "guests", label: "Guests", show: can("Guests", "read") },
  ];
  const goNewBooking = (roomId: string, date: string) => {
    setPrefill({ roomId, date });
    setTab("new");
  };

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">
          Front desk ·{" "}
          {new Date().toLocaleDateString("en-KE", { weekday: "long", month: "short", day: "numeric" })}
        </p>
        <h1 className="hero-title font-display text-headline-lg">Today at a glance</h1>
      </header>

      <div role="tablist" className="seg flex-wrap">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`seg-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "today" && (
        <TodayBoard
          canWrite={can("Bookings", "write")}
          canPay={can("Payments", "write")}
          onQuickNav={setTab}
        />
      )}
      {tab === "calendar" && (
        <CalendarGrid canBook={can("Bookings", "write")} onBookCell={goNewBooking} />
      )}
      {tab === "rooms" && <RoomsBoard canManage={can("Rooms", "manage")} onBook={goNewBooking} />}
      {tab === "new" && can("Bookings", "write") && <NewBooking prefill={prefill} />}
      {tab === "guests" && can("Guests", "read") && (
        <GuestsSection canWrite={can("Guests", "write")} />
      )}
    </section>
  );
}

/* ───────────────────────── Today (V.desk) ───────────────────────── */

type BoardRow = {
  bookingId: Id<"bookings">;
  reference: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  roomId: Id<"rooms">;
  roomNumber: string;
  balanceCents: bigint;
};

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "primary" | "info" | "warning" | "danger";
}) {
  const tones = {
    primary: "bg-badge-success text-badge-success-fg",
    info: "bg-badge-info text-badge-info-fg",
    warning: "bg-badge-warning text-badge-warning-fg",
    danger: "bg-badge-danger text-badge-danger-fg",
  };
  return (
    <div className="card card-hover flex flex-col gap-1.5">
      <span className={`kpi-icon mb-1 ${tones[tone]}`}>{icon}</span>
      <span className="text-label-caps uppercase text-text-muted">{label}</span>
      <span className="kpi-value text-text">{value}</span>
    </div>
  );
}

function TodayBoard({
  canWrite,
  canPay,
  onQuickNav,
}: {
  canWrite: boolean;
  canPay: boolean;
  onQuickNav: (t: Tab) => void;
}) {
  const [date, setDate] = useState(todayIso());
  const board = useQuery(api.deskBookings.board, { date });

  if (board === undefined) return <p className="text-sm text-text-muted">Loading board…</p>;

  const pendingPay = [...board.arrivals, ...board.inHouse].filter(
    (b) => b.balanceCents > 0n,
  ).length;

  return (
    <div className="space-y-5">
      {/* KPI tiles (prototype kpi widgets) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<LogIn className="size-5" />} label="Arrivals" value={board.arrivals.length} tone="primary" />
        <Kpi icon={<LogOut className="size-5" />} label="Departures" value={board.departures.length} tone="warning" />
        <Kpi icon={<Hotel className="size-5" />} label="In-house" value={board.inHouse.length} tone="info" />
        <Kpi icon={<Wallet className="size-5" />} label="Pending pay" value={pendingPay} tone="danger" />
      </div>

      {/* Workflow strip */}
      <div className="card card-pad-sm flex flex-wrap items-center gap-2 !py-3">
        <span className="text-label-caps uppercase text-text-muted">Workflow</span>
        {["Booking", "Arrival", "Check-In", "Occupancy", "Check-Out"].map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="size-3 text-text-dim" aria-hidden="true" />}
            <span className="inline-flex rounded-full bg-badge-info px-2.5 py-0.5 text-xs font-semibold text-badge-info-fg">
              {s}
            </span>
          </span>
        ))}
      </div>

      {/* Quick actions (prototype qa-grid) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { icon: <DoorOpen className="size-5" />, label: "New booking", tab: "new", tone: "bg-badge-success text-badge-success-fg", show: canWrite },
            { icon: <UserSearch className="size-5" />, label: "Find guest", tab: "guests", tone: "bg-badge-info text-badge-info-fg", show: true },
            { icon: <Hotel className="size-5" />, label: "Room board", tab: "rooms", tone: "bg-badge-premium text-badge-premium-fg", show: true },
            { icon: <CalendarDays className="size-5" />, label: "Calendar", tab: "calendar", tone: "bg-badge-warning text-badge-warning-fg", show: true },
          ] as const
        )
          .filter((a) => a.show)
          .map((a) => (
            <button
              key={a.label}
              onClick={() => onQuickNav(a.tab as Tab)}
              className="card card-hover flex flex-col items-start gap-2 !p-4 text-left"
            >
              <span className={`kpi-icon ${a.tone}`}>{a.icon}</span>
              <span className="text-sm font-semibold text-text">{a.label}</span>
            </button>
          ))}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-text-muted">Board date</span>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
      </label>

      {/* Arrivals / In-house boards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 flex items-center gap-2 font-display text-headline-sm text-text">
            <LogIn className="size-5 text-primary" aria-hidden="true" /> Arrivals & pending
          </h2>
          <div className="divide-rows">
            {[...board.pending, ...board.arrivals.filter((a) => a.status !== "pending")].length === 0 ? (
              <p className="px-1 py-3 text-body-md text-text-muted">No arrivals pending.</p>
            ) : (
              [...board.pending, ...board.arrivals.filter((a) => a.status !== "pending")].map((b) => (
                <BookingRow key={`arr-${b.bookingId}`} b={b} canWrite={canWrite} canPay={canPay} />
              ))
            )}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 flex items-center gap-2 font-display text-headline-sm text-text">
            <LogOut className="size-5 text-warning" aria-hidden="true" /> In-house & checkouts
          </h2>
          <div className="divide-rows">
            {board.inHouse.length === 0 ? (
              <p className="px-1 py-3 text-body-md text-text-muted">Nobody in-house.</p>
            ) : (
              board.inHouse.map((b) => (
                <BookingRow key={`in-${b.bookingId}`} b={b} canWrite={canWrite} canPay={canPay} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Booking list-row with the expandable lifecycle actions (logic unchanged). */
function BookingRow({ b, canWrite, canPay }: { b: BoardRow; canWrite: boolean; canPay: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const confirmBooking = useMutation(api.deskBookings.confirm);
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
  const [confirmAction, setConfirmAction] = useState<null | "cancel" | "noshow" | "refund">(null);

  const run = (p: Promise<unknown>, ok: string) => {
    setNote(null);
    p.then(() => setNote(ok)).catch((e) => setNote(String(e.message ?? e)));
  };
  const initials = b.guestName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="py-1">
      <div className="list-row !px-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-badge-success text-sm font-bold text-badge-success-fg">
          {initials || "G"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text">{b.guestName}</p>
          <p className="truncate font-mono text-body-md text-text-muted">
            {b.reference} · Rm {b.roomNumber} · {b.checkInDate} → {b.checkOutDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip
            status={b.status === "checked_in" ? "info" : b.status === "pending" ? "warning" : "success"}
          >
            {b.status.replaceAll("_", " ")}
          </StatusChip>
          <span className={`font-mono text-sm ${b.balanceCents > 0n ? "font-semibold text-text" : "text-text-muted"}`}>
            {formatKes(b.balanceCents)}
          </span>
          {canWrite && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              Actions
            </Button>
          )}
        </div>
      </div>

      {canWrite && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={`${b.guestName} · ${b.reference}`}
        >
          <div className="space-y-3 text-sm">
            <p className="font-mono text-body-md text-text-muted">
              Rm {b.roomNumber} · {b.checkInDate} → {b.checkOutDate} · Balance{" "}
              {formatKes(b.balanceCents)}
            </p>
          {b.status === "pending" && (
            <Button size="sm" onClick={() => run(confirmBooking({ bookingId: b.bookingId }), "Confirmed.")}>
              Confirm booking
            </Button>
          )}
          {b.status === "confirmed" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={idVerified} onChange={(e) => setIdVerified(e.target.checked)} />
                ID verified
              </label>
              <Button size="sm" onClick={() => run(checkIn({ bookingId: b.bookingId, idVerified }), "Checked in.")}>
                <LogIn className="size-4" aria-hidden="true" /> Check in
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction("noshow")}>
                No-show
              </Button>
            </div>
          )}
          {canPay && (b.status === "confirmed" || b.status === "checked_in") && (
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className="mb-1 block text-text-muted">Record payment</span>
                <select
                  aria-label="Payment method"
                  className="rounded-ctrl border border-border bg-bg-input px-2 py-2"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                >
                  <option value="cash">cash</option>
                  <option value="mpesa_manual">M-Pesa (manual ref)</option>
                  <option value="card">card</option>
                </select>
              </label>
              <Input aria-label="Payment amount KES" placeholder="KES" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-28" />
              {payMethod === "mpesa_manual" && (
                <Input aria-label="M-Pesa receipt" placeholder="Receipt code" value={payReceipt} onChange={(e) => setPayReceipt(e.target.value)} className="w-36" />
              )}
              <Button
                size="sm"
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
            <div className="space-y-2 rounded-ctrl border border-border p-3">
              <p className="font-semibold text-text">Check out</p>
              <AssetCheckBlock bookingId={b.bookingId} roomId={b.roomId} onNote={setNote} />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={assetOk} onChange={(e) => setAssetOk(e.target.checked)} />
                Assets verified OK
              </label>
              {!assetOk && (
                <div className="flex flex-wrap gap-2">
                  <Input aria-label="Damage notes" placeholder="Damage notes" value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} className="w-52" />
                  <Input aria-label="Damage charge KES" placeholder="Charge KES" value={damageAmount} onChange={(e) => setDamageAmount(e.target.value)} className="w-28" />
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
                  size="sm"
                  onClick={() =>
                    run(
                      checkOut({
                        bookingId: b.bookingId,
                        balanceException: exceptionReason ? { reason: exceptionReason } : undefined,
                        assetCheck: {
                          ok: assetOk,
                          notes: damageNotes || undefined,
                          damageChargeCents: !assetOk && damageAmount ? kesToCents(damageAmount) : undefined,
                        },
                      }),
                      "Checked out — housekeeping queued.",
                    )
                  }
                >
                  <LogOut className="size-4" aria-hidden="true" /> Complete check-out
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    run(generateInvoice({ bookingId: b.bookingId, isReceipt: true }), "Receipt generated (guest portal).")
                  }
                >
                  Issue receipt
                </Button>
              </div>
            </div>
          )}
          {(b.status === "pending" || b.status === "confirmed" || b.status === "checked_in") && (
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className="mb-1 block text-text-muted">Extend to</span>
                <Input type="date" aria-label="New check-out date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} className="w-40" />
              </label>
              <Button variant="ghost" size="sm" onClick={() => run(extend({ bookingId: b.bookingId, newCheckOutDate: extendDate }), "Extended — charge posted.")}>
                Extend
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction("cancel")}>
                Cancel booking
              </Button>
              {canPay && (
                <>
                  <Input aria-label="Refund amount KES" placeholder="Refund KES" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-28" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmAction("refund")}
                  >
                    Refund
                  </Button>
                </>
              )}
            </div>
          )}
            {note && <p className="text-text-muted">{note}</p>}
          </div>
          <ConfirmDialog
            open={confirmAction === "cancel"}
            onClose={() => setConfirmAction(null)}
            onConfirm={() => {
              run(cancel({ bookingId: b.bookingId, reason: "Desk cancellation" }), "Cancelled.");
              setConfirmAction(null);
            }}
            title="Cancel this booking?"
            message={`This cancels ${b.guestName}'s booking (${b.reference}) and can't be undone.`}
            confirmLabel="Cancel booking"
            cancelLabel="Keep it"
            danger
          />
          <ConfirmDialog
            open={confirmAction === "noshow"}
            onClose={() => setConfirmAction(null)}
            onConfirm={() => {
              run(markNoShow({ bookingId: b.bookingId }), "Marked no-show.");
              setConfirmAction(null);
            }}
            title="Mark as no-show?"
            message={`${b.guestName} (${b.reference}) will be recorded as a no-show.`}
            confirmLabel="Mark no-show"
            danger
          />
          <ConfirmDialog
            open={confirmAction === "refund"}
            onClose={() => setConfirmAction(null)}
            onConfirm={() => {
              run(
                refund({ bookingId: b.bookingId, amountCents: kesToCents(refundAmount), reason: "Desk refund" }),
                "Refund recorded (settle out-of-band).",
              );
              setConfirmAction(null);
            }}
            title="Record this refund?"
            message={`Refund ${refundAmount ? formatKes(kesToCents(refundAmount)) : "—"} to ${b.guestName}; settle the money out-of-band.`}
            confirmLabel="Record refund"
            danger
          />
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────── Calendar (V.calendar — cal grid) ─────────────────── */

const CAL_BG: Record<string, string> = {
  confirmed: "rgba(56,189,248,.30)",
  checked_in: "rgba(20,184,166,.34)",
  pending: "rgba(245,158,11,.30)",
  checked_out: "rgba(154,168,196,.18)",
};

function CalendarGrid({
  canBook,
  onBookCell,
}: {
  canBook: boolean;
  onBookCell: (roomId: string, date: string) => void;
}) {
  const [from, setFrom] = useState(todayIso());
  const to = useMemo(() => addDays(from, 14), [from]);
  const grid = useQuery(api.calendar.grid, { from, to });
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(from, i)), [from]);
  const today = todayIso();
  const wk = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (grid === undefined) return <p className="text-sm text-text-muted">Loading calendar…</p>;

  return (
    <div className="space-y-3">
      <div className="card card-pad-sm flex flex-wrap items-center gap-2 !py-3">
        {(
          [
            ["info", "Confirmed"],
            ["success", "In-house"],
            ["warning", "Pending"],
            ["danger", "Blocked"],
          ] as const
        ).map(([tone, label]) => (
          <StatusChip key={label} status={tone}>{label}</StatusChip>
        ))}
        {canBook && (
          <span className="rounded-full bg-bg-input px-2.5 py-0.5 text-xs font-semibold text-text-muted">
            + Free = tap to book
          </span>
        )}
        <label className="ml-auto text-sm">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </label>
      </div>

      <div className="card overflow-hidden !p-0">
        <div className="cal hide-scroll">
          <div className="cal-row cal-head">
            <div className="cal-room cal-corner">
              <span className="text-label-caps uppercase text-text-muted">Room</span>
            </div>
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00Z`);
              return (
                <div key={d} className={`cal-day${d === today ? " is-today" : ""}`}>
                  <span>{dt.getUTCDate()}</span>
                  <small>{d === today ? "Today" : wk[dt.getUTCDay()]}</small>
                </div>
              );
            })}
          </div>
          {grid.map((room) => (
            <div key={room.roomId} className="cal-row">
              <div className="cal-room">
                <span className="font-mono font-semibold text-text">{room.number}</span>
                <small>{room.typeName}</small>
              </div>
              {days.map((d) => {
                const span = room.spans.find((s) => s.checkInDate <= d && s.checkOutDate > d);
                if (span) {
                  const start = span.checkInDate === d;
                  const initials = span.guestName
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <div
                      key={d}
                      className={`cal-cell${d === today ? " is-today" : ""}`}
                      title={`${span.guestName} · ${span.reference} (${span.status})`}
                      style={{ background: CAL_BG[span.status] ?? CAL_BG.confirmed }}
                    >
                      {start && <span className="cal-tag">{initials || "•"}</span>}
                    </div>
                  );
                }
                const blocked = room.roomStatus === "maintenance" || room.roomStatus === "blocked";
                return canBook && !blocked ? (
                  <button
                    key={d}
                    type="button"
                    className={`cal-cell free${d === today ? " is-today" : ""}`}
                    aria-label={`Book room ${room.number} for ${d}`}
                    title={`${room.number} available ${d}`}
                    onClick={() => onBookCell(room.roomId, d)}
                  />
                ) : (
                  <div
                    key={d}
                    className={`cal-cell${d === today ? " is-today" : ""}`}
                    style={blocked ? { background: "rgba(244,63,94,.14)" } : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-body-md text-text-muted">
        {grid.length} rooms · next 14 days. Overlapping dates are blocked automatically to
        prevent double-bookings.
      </p>
    </div>
  );
}

/* ──────────────── Rooms board (V.occupancy + status panel) ──────────────── */

const ROOM_STATUSES = ["available", "occupied", "dirty", "cleaning", "maintenance", "blocked"] as const;
type RoomStatus = (typeof ROOM_STATUSES)[number];
const ROOM_CHIP: Record<RoomStatus, "success" | "info" | "warning" | "danger"> = {
  available: "success",
  occupied: "info",
  dirty: "warning",
  cleaning: "warning",
  maintenance: "danger",
  blocked: "danger",
};

function RoomsBoard({
  canManage,
  onBook,
}: {
  canManage: boolean;
  onBook: (roomId: string, date: string) => void;
}) {
  const rooms = useQuery(api.rooms.list, {});
  const setStatus = useMutation(api.rooms.setStatus);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (rooms === undefined) return <p className="text-sm text-text-muted">Loading rooms…</p>;
  if (rooms.length === 0)
    return <EmptyState title="No rooms" description="Add rooms in Property setup first." />;

  const floors = [...new Set(rooms.map((r) => r.floor ?? "—"))].sort();
  const selected = rooms.find((r) => r._id === openRoom);

  return (
    <div className="space-y-5">
      <div className="card card-pad-sm flex flex-wrap items-center gap-2 !py-3">
        {ROOM_STATUSES.map((s) => (
          <StatusChip key={s} status={ROOM_CHIP[s]}>{s}</StatusChip>
        ))}
        <span className="rounded-full bg-bg-input px-2.5 py-0.5 text-xs font-semibold text-text-muted">
          Tap a room to update status
        </span>
      </div>

      {floors.map((f) => (
        <div key={f}>
          <p className="text-label-caps mb-2 uppercase text-text-muted">Floor {f}</p>
          <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rooms
              .filter((r) => (r.floor ?? "—") === f)
              .map((r) => (
                <button
                  key={r._id}
                  onClick={() => setOpenRoom(r._id)}
                  className="card card-hover !p-4 text-left"
                  aria-label={`Room ${r.number} — ${r.status}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-text">{r.number}</span>
                    <StatusChip status={ROOM_CHIP[r.status as RoomStatus]}>{r.status}</StatusChip>
                  </div>
                  <p className="mt-1.5 text-body-md text-text">{r.roomTypeName}</p>
                  <p className="text-body-md text-text-muted">{r.branchName}</p>
                </button>
              ))}
          </div>
        </div>
      ))}

      {/* Right-docked status panel (prototype rpanel) */}
      {selected && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Room ${selected.number} status`}
        >
          <button
            aria-label="Close panel"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setOpenRoom(null)}
          />
          <aside className="fade-in relative flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-bg-card shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5 py-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-headline-sm text-text">
                  Room {selected.number} · {selected.roomTypeName}
                </h3>
                <p className="text-body-md text-text-muted">{selected.branchName}</p>
              </div>
              <StatusChip status={ROOM_CHIP[selected.status as RoomStatus]}>{selected.status}</StatusChip>
              <button className="icon-btn" aria-label="Close" onClick={() => setOpenRoom(null)}>
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-label-caps mb-2 uppercase text-text-muted">Set status</p>
              <div className="grid grid-cols-2 gap-2">
                {ROOM_STATUSES.map((s) => (
                  <Button
                    key={s}
                    variant={s === selected.status ? "primary" : "ghost"}
                    disabled={!canManage || s === selected.status}
                    className="justify-start"
                    onClick={() => {
                      setNote(null);
                      setStatus({ roomId: selected._id, status: s })
                        .then(() => setNote(`${selected.number} → ${s}`))
                        .catch((e) => setNote(String(e.message ?? e)));
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              {!canManage && (
                <p className="mt-3 flex items-center gap-1.5 text-body-md text-text-muted">
                  <CircleAlert className="size-4" aria-hidden="true" /> Status changes need
                  Rooms permission.
                </p>
              )}
              {note && <p className="mt-3 text-body-md text-primary">{note}</p>}
            </div>
            <div className="flex gap-2.5 border-t border-[var(--hairline)] px-5 py-4">
              {selected.status === "available" && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    setOpenRoom(null);
                    onBook(selected._id, todayIso());
                  }}
                >
                  Book this room
                </Button>
              )}
              <Button variant="ghost" className="flex-1" onClick={() => setOpenRoom(null)}>
                Close
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ───────────────────── New booking (6.1, prefillable) ───────────────────── */

function NewBooking({ prefill }: { prefill: { roomId: string; date: string } | null }) {
  const guests = useQuery(api.guests.list, {});
  const rooms = useQuery(api.rooms.list, {});
  const create = useMutation(api.deskBookings.create);

  const [guestId, setGuestId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [roomId, setRoomId] = useState(prefill?.roomId ?? "");
  const [checkIn, setCheckIn] = useState(prefill?.date ?? todayIso());
  const [checkOut, setCheckOut] = useState(addDays(prefill?.date ?? todayIso(), 1));
  const [source, setSource] = useState<"walk_in" | "phone" | "direct" | "whatsapp">("walk_in");
  const [note, setNote] = useState<string | null>(null);

  if (guests === undefined || rooms === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }

  return (
    <div className="card max-w-2xl">
      <h2 className="mb-4 font-display text-headline-sm text-text">Walk-in / phone booking</h2>
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
            setNote(`Booked ${res.reference} — ${formatKes(res.expectedTotalCents)} expected.`);
          } catch (err) {
            setNote(String((err as Error).message ?? err));
          }
        }}
      >
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Existing guest"
            className="rounded-ctrl border border-border bg-bg-input px-2 py-2"
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
              <Input aria-label="Guest name" placeholder="Guest name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-48" />
              <Input aria-label="Guest phone" placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-40" />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Room"
            className="rounded-ctrl border border-border bg-bg-input px-2 py-2"
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
          <Input type="date" aria-label="Check-in" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-40" />
          <Input type="date" aria-label="Check-out" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-40" />
          <select
            aria-label="Source"
            className="rounded-ctrl border border-border bg-bg-input px-2 py-2"
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
        {note && <p className="text-text-muted">{note}</p>}
      </form>
    </div>
  );
}

/* ───────────────── Guests (V.lookup — stat cards) ───────────────── */

function GuestsSection({ canWrite }: { canWrite: boolean }) {
  const [search, setSearch] = useState("");
  const guests = useQuery(api.guests.list, { search: search || undefined });
  const create = useMutation(api.guests.create);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  if (guests === undefined) return <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <Input
        aria-label="Search guests"
        placeholder="Search by name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      {guests.length === 0 ? (
        <EmptyState title="No guests found" description="Try another name or number." />
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {guests.map((g) => {
            const initials = g.fullName
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <div key={g.guestId} className="card card-hover">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-badge-success font-bold text-badge-success-fg">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">{g.fullName}</p>
                    <p className="truncate text-body-md text-text-muted">
                      {g.phone}
                      {g.email ? ` · ${g.email}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="card card-pad-sm !p-3">
                    <p className="kpi-value font-mono !text-lg text-text">{g.bookingCount}</p>
                    <p className="text-body-md text-text-muted">Stays</p>
                  </div>
                  <div className="card card-pad-sm !p-3">
                    <p className="kpi-value font-mono !text-lg text-text">
                      {formatKes(g.totalSpentCents)}
                    </p>
                    <p className="text-body-md text-text-muted">Spent</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
          <Input aria-label="New guest name" placeholder="New guest name" value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
          <Input aria-label="New guest phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-40" />
          <Button type="submit" disabled={!name || !phone}>
            Add guest
          </Button>
        </form>
      )}
    </div>
  );
}

/* ─────────────── Story 7.7: per-asset checkout verification ─────────────── */

function AssetCheckBlock({
  bookingId,
  roomId,
  onNote,
}: {
  bookingId: Id<"bookings">;
  roomId: Id<"rooms">;
  onNote: (s: string) => void;
}) {
  const { can } = usePermissions();
  const assets = useQuery(api.assets.listByRoom, can("Assets", "read") ? { roomId } : "skip");
  const verify = useMutation(api.assets.verifyCheckout);
  const [conditions, setConditions] = useState<
    Record<string, { condition: "present" | "missing" | "damaged"; charge: string }>
  >({});
  const [done, setDone] = useState(false);

  if (!assets || assets.length === 0 || !can("Assets", "write")) return null;

  const submit = () =>
    verify({
      bookingId,
      results: assets.map((a) => {
        const c = conditions[a.assetId] ?? { condition: "present" as const, charge: "" };
        return {
          assetId: a.assetId,
          condition: c.condition,
          chargeCents:
            c.condition !== "present" && c.charge ? kesToCents(c.charge) : undefined,
        };
      }),
    })
      .then((r) => {
        setDone(true);
        onNote(
          r.discrepancies === 0
            ? "Asset check passed — all present."
            : `Asset check: ${r.discrepancies} discrepancie(s), ${formatKes(r.chargedCents)} charged.`,
        );
      })
      .catch((e) => onNote(String(e.message ?? e)));

  return (
    <div className="space-y-2 rounded-ctrl border border-border p-2">
      <p className="text-label-caps uppercase text-text-muted">Room asset check</p>
      {assets.map((a) => {
        const c = conditions[a.assetId] ?? { condition: "present" as const, charge: "" };
        return (
          <div key={a.assetId} className="flex flex-wrap items-center gap-2">
            <span className="min-w-28 text-text">{a.name}</span>
            <select
              aria-label={`${a.name} condition`}
              className="rounded-ctrl border border-border bg-bg-input px-2 py-1.5"
              value={c.condition}
              disabled={done}
              onChange={(e) =>
                setConditions({
                  ...conditions,
                  [a.assetId]: { ...c, condition: e.target.value as typeof c.condition },
                })
              }
            >
              <option value="present">present</option>
              <option value="missing">missing</option>
              <option value="damaged">damaged</option>
            </select>
            {c.condition !== "present" && (
              <Input
                aria-label={`${a.name} charge KES`}
                placeholder="Charge KES"
                value={c.charge}
                disabled={done}
                onChange={(e) =>
                  setConditions({ ...conditions, [a.assetId]: { ...c, charge: e.target.value } })
                }
                className="w-28"
              />
            )}
          </div>
        );
      })}
      <Button size="sm" variant="ghost" disabled={done} onClick={submit}>
        {done ? "Asset check recorded ✓" : "Record asset check"}
      </Button>
    </div>
  );
}
