"use client";

import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { formatKes } from "@/lib/money";
import { EmptyState, StatusChip } from "@/components/ui";
import { DonutIcon, BanknoteIcon, LogIn, Brush } from "lucide-react";

/**
 * Operations workspace (prototype V.ops): KPI tiles, revenue last-7-days bar
 * chart, forward 7-day occupancy projection, plus pending housekeeping tasks
 * and open guest requests — all derived live from real records via
 * opsDashboard.summary (Dashboard:read). Historical analytics (retention,
 * satisfaction, peak hours) are Epic 10 scope (gap-listed).
 */
function BarChart({
  bars,
  fmt,
}: {
  bars: { label: string; value: number; title: string }[];
  fmt?: (v: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex h-40 items-end gap-2">
      {bars.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-t-md bg-[linear-gradient(180deg,var(--primary),rgba(20,184,166,0.3))] transition-[height] duration-700"
            style={{ height: `${Math.max(3, (b.value / max) * 100)}%` }}
            title={b.title}
          />
          <span className="text-[11px] text-text-muted">{b.label}</span>
          {fmt && <span className="font-mono text-[10px] text-text-dim">{fmt(b.value)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function OperationsPage() {
  const { can, isLoading } = usePermissions();
  const summary = useQuery(api.opsDashboard.summary);
  const tasks = useQuery(api.housekeeping.list);
  const board = useQuery(api.deskBookings.board, {
    date: new Date().toISOString().slice(0, 10),
  });

  if (isLoading) return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  if (!can("Dashboard", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have operations permissions." />
      </div>
    );
  }
  if (summary === undefined) {
    return <p className="p-6 text-sm text-text-muted">Loading operations…</p>;
  }

  const kpis = [
    {
      icon: <DonutIcon className="size-5" />,
      label: "Occupancy",
      value: `${summary.occupancyPct}%`,
      sub: `${summary.occupied} of ${summary.rooms} rooms`,
      tone: "bg-badge-success text-badge-success-fg",
    },
    {
      icon: <BanknoteIcon className="size-5" />,
      label: "Revenue today",
      value: formatKes(summary.revenueTodayCents),
      sub: "confirmed payments",
      tone: "bg-badge-premium text-badge-premium-fg",
      mono: true,
    },
    {
      icon: <LogIn className="size-5" />,
      label: "Arrivals",
      value: summary.arrivalsToday,
      sub: `${summary.departuresToday} departures · ${summary.inHouse} in-house`,
      tone: "bg-badge-info text-badge-info-fg",
    },
    {
      icon: <Brush className="size-5" />,
      label: "Pending tasks",
      value: summary.pendingTasks,
      sub: `${summary.openRequests} open requests`,
      tone: "bg-badge-warning text-badge-warning-fg",
    },
  ];

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">Operations</p>
        <h1 className="hero-title font-display text-headline-lg">Daily operations</h1>
        <p className="mt-1 text-body-lg text-text-muted">Live performance across the property</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card card-hover flex flex-col gap-1.5">
            <span className={`kpi-icon mb-1 ${k.tone}`}>{k.icon}</span>
            <span className="text-label-caps uppercase text-text-muted">{k.label}</span>
            <span className={`kpi-value text-text ${k.mono ? "font-mono !text-xl" : ""}`}>{k.value}</span>
            <span className="text-body-md text-text-muted">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-headline-sm text-text">Revenue · last 7 days</h2>
            <span className="font-mono text-primary">
              {formatKes(summary.revenue7d.reduce((a, b) => a + b.cents, 0n))}
            </span>
          </div>
          <BarChart
            bars={summary.revenue7d.map((d) => ({
              label: d.day,
              value: Number(d.cents / 100n),
              title: `${d.day}: ${formatKes(d.cents)}`,
            }))}
          />
        </div>
        <div className="card">
          <h2 className="mb-3 font-display text-headline-sm text-text">
            Occupancy · next 7 days (booked)
          </h2>
          <BarChart
            bars={summary.next7d.map((d) => ({
              label: d.day,
              value: d.pct,
              title: `${d.day}: ${d.pct}%`,
            }))}
            fmt={(v) => `${v}%`}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-display text-headline-sm text-text">Upcoming arrivals</h2>
          <div className="divide-rows">
            {board === undefined ? (
              <p className="py-2 text-body-md text-text-muted">Loading…</p>
            ) : board.arrivals.length === 0 ? (
              <p className="py-2 text-body-md text-text-muted">No arrivals today.</p>
            ) : (
              board.arrivals.slice(0, 5).map((b) => (
                <div key={b.bookingId} className="list-row !px-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text">{b.guestName}</p>
                    <p className="font-mono text-body-md text-text-muted">
                      {b.reference} · Rm {b.roomNumber}
                    </p>
                  </div>
                  <StatusChip status={b.status === "pending" ? "warning" : "success"}>
                    {b.status.replaceAll("_", " ")}
                  </StatusChip>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-3 font-display text-headline-sm text-text">Pending tasks</h2>
          <div className="divide-rows">
            {tasks === undefined ? (
              <p className="py-2 text-body-md text-text-muted">Loading…</p>
            ) : tasks.filter((t) => t.status !== "completed").length === 0 ? (
              <p className="py-2 text-body-md text-text-muted">All caught up.</p>
            ) : (
              tasks
                .filter((t) => t.status !== "completed")
                .slice(0, 5)
                .map((t) => (
                  <div key={t.taskId} className="list-row !px-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text">
                        Cleaning · <span className="font-mono">Rm {t.roomNumber}</span>
                      </p>
                      <p className="truncate text-body-md text-text-muted">{t.notes}</p>
                    </div>
                    <StatusChip status={t.status === "in_progress" ? "info" : "warning"}>
                      {t.status.replaceAll("_", " ")}
                    </StatusChip>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
