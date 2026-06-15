"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { roleLabel } from "@/lib/roles";
import { formatKes } from "@/lib/money";
import { EmptyState } from "@/components/ui";
import {
  Users,
  CalendarCheck,
  BanknoteIcon,
  DonutIcon,
  ShieldCheck,
  Hotel,
  Wallet,
  ConciergeBell,
  ChevronRight,
  History,
  Boxes,
  BarChart3,
  UtensilsCrossed,
  ListTodo,
} from "lucide-react";

/**
 * Admin overview (prototype V.overview): live KPI row, tappable module cards,
 * and the activity feed (audit log). KPIs come from opsDashboard.summary;
 * the feed from audit.list — each section renders only with its permission.
 */
const MODULES = [
  {
    href: "/admin/access",
    icon: <ShieldCheck className="size-5" />,
    title: "Users, roles & audit",
    sub: "Staff, permissions matrix, audit log",
    tone: "bg-badge-info text-badge-info-fg",
  },
  {
    href: "/admin/setup",
    icon: <Hotel className="size-5" />,
    title: "Property setup",
    sub: "Rooms, types, rates & notifications",
    tone: "bg-badge-success text-badge-success-fg",
  },
  {
    href: "/admin/payments",
    icon: <Wallet className="size-5" />,
    title: "Payments",
    sub: "Methods, M-Pesa, reconciliation",
    tone: "bg-badge-premium text-badge-premium-fg",
  },
  {
    href: "/front-desk",
    icon: <ConciergeBell className="size-5" />,
    title: "Front desk",
    sub: "Bookings, calendar & room board",
    tone: "bg-badge-warning text-badge-warning-fg",
  },
  {
    href: "/admin/inventory",
    icon: <Boxes className="size-5" />,
    title: "Inventory & purchases",
    sub: "Products, stock, suppliers & POs",
    tone: "bg-badge-info text-badge-info-fg",
  },
  {
    href: "/admin/reports",
    icon: <BarChart3 className="size-5" />,
    title: "Reports & exports",
    sub: "Revenue, occupancy, P&L, tax, CSV",
    tone: "bg-badge-success text-badge-success-fg",
  },
];

function ActionQueue({ items }: { items: [number, string, string][] }) {
  const due = items.filter(([n]) => n > 0);
  if (due.length === 0) {
    return <p className="py-1 text-body-md text-text-muted">Nothing needs attention. 🎉</p>;
  }
  return (
    <>
      {due.map(([n, label, href]) => (
        <Link key={label} href={href} className="list-row !px-1">
          <span className="grid size-8 place-items-center rounded-full bg-badge-warning font-mono text-sm font-bold text-badge-warning-fg">
            {n}
          </span>
          <span className="flex-1 text-body-md text-text">{label}</span>
          <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
        </Link>
      ))}
    </>
  );
}

export default function AdminOverviewPage() {
  const { can, isLoading } = usePermissions();
  const me = useQuery(api.identity.me);
  const summary = useQuery(api.opsDashboard.summary);
  const audit = useQuery(api.audit.list, { limit: 6 });

  if (isLoading) return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  if (!can("Dashboard", "read") && !can("Roles", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have admin permissions." />
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();
  const firstName = me?.name?.split(/\s+/)[0] ?? "there";

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">
          {roleLabel(me?.role)}
          {me?.org ? ` · ${me.org.name}` : ""}
        </p>
        <h1 className="hero-title font-display text-headline-lg">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-1 text-body-lg text-text-muted">
          Everything at a glance — tap a card to manage.
        </p>
      </header>

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card card-hover flex flex-col gap-1.5">
            <span className="kpi-icon mb-1 bg-badge-info text-badge-info-fg">
              <Users className="size-5" />
            </span>
            <span className="text-label-caps uppercase text-text-muted">In-house</span>
            <span className="kpi-value text-text">{summary.inHouse}</span>
          </div>
          <div className="card card-hover flex flex-col gap-1.5">
            <span className="kpi-icon mb-1 bg-badge-success text-badge-success-fg">
              <CalendarCheck className="size-5" />
            </span>
            <span className="text-label-caps uppercase text-text-muted">Arrivals today</span>
            <span className="kpi-value text-text">{summary.arrivalsToday}</span>
          </div>
          <div className="card card-hover flex flex-col gap-1.5">
            <span className="kpi-icon mb-1 bg-badge-premium text-badge-premium-fg">
              <BanknoteIcon className="size-5" />
            </span>
            <span className="text-label-caps uppercase text-text-muted">Revenue today</span>
            <span className="kpi-value font-mono !text-xl text-text">
              {formatKes(summary.revenueTodayCents)}
            </span>
          </div>
          <div className="card card-hover flex flex-col gap-1.5">
            <span className="kpi-icon mb-1 bg-badge-warning text-badge-warning-fg">
              <DonutIcon className="size-5" />
            </span>
            <span className="text-label-caps uppercase text-text-muted">Occupancy</span>
            <span className="kpi-value text-text">{summary.occupancyPct}%</span>
          </div>
          <div className="card card-hover flex flex-col gap-1.5">
            <span className="kpi-icon mb-1 bg-badge-premium text-badge-premium-fg">
              <UtensilsCrossed className="size-5" />
            </span>
            <span className="text-label-caps uppercase text-text-muted">Restaurant today</span>
            <span className="kpi-value font-mono !text-xl text-text">
              {formatKes(summary.restaurantTodayCents)}
            </span>
          </div>
          <div className="card card-hover flex flex-col gap-1.5">
            <span className="kpi-icon mb-1 bg-badge-danger text-badge-danger-fg">
              <Wallet className="size-5" />
            </span>
            <span className="text-label-caps uppercase text-text-muted">Outstanding</span>
            <span className="kpi-value font-mono !text-xl text-text">
              {formatKes(summary.outstandingCents)}
            </span>
          </div>
        </div>
      )}

      {/* 10.1 — daily action queue: what needs a human, in one list */}
      {summary && (
        <div className="card">
          <h2 className="mb-2 flex items-center gap-2 font-display text-headline-sm text-text">
            <ListTodo className="size-5 text-primary" aria-hidden="true" /> Action queue
          </h2>
          <ActionQueue
            items={[
              [summary.openEscalations, "open escalation(s)", "/operations"],
              [summary.lateCheckouts, "late checkout(s)", "/front-desk"],
              [summary.arrivalsToday, "arrival(s) to check in", "/front-desk"],
              [summary.pendingTasks, "cleaning task(s) pending", "/housekeeping"],
              [summary.openRequests, "open guest request(s)", "/front-desk"],
            ]}
          />
        </div>
      )}

      <div>
        <h2 className="mb-2 font-display text-headline-sm text-text">Manage</h2>
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className="card card-hover flex items-center gap-3 !p-4">
              <span className={`kpi-icon ${m.tone}`}>{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-text">{m.title}</span>
                <span className="block truncate text-body-md text-text-muted">{m.sub}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>

      {can("Audit logs", "read") && (
        <div className="card">
          <h2 className="mb-2 flex items-center gap-2 font-display text-headline-sm text-text">
            <History className="size-5 text-primary" aria-hidden="true" /> Recent activity
          </h2>
          {audit === undefined ? (
            <p className="py-2 text-body-md text-text-muted">Loading…</p>
          ) : audit.length === 0 ? (
            <p className="py-2 text-body-md text-text-muted">No activity yet.</p>
          ) : (
            <div>
              {audit.map((a) => (
                <div key={a._id} className="feed-item">
                  <span className="feed-dot bg-badge-info text-badge-info-fg">
                    <History className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md text-text">
                      {a.action.replaceAll(".", " · ").replaceAll("_", " ")}
                    </p>
                    <p className="font-mono text-[11px] text-text-dim">
                      {new Date(a._creationTime).toLocaleTimeString("en-KE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
