"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { usePermissions } from "@/lib/use-permissions";
import { formatKes } from "@/lib/money";
import {
  Button,
  EmptyState,
  Input,
  StatusChip,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui";
import { Download, Printer } from "lucide-react";

/**
 * Reports & exports (Epic 10, Stories 10.2–10.5). Each tab renders a live
 * Reports:read query; figures always trace to source records. Exports are
 * client-side: CSV from the on-screen payload (10.5), PDF via the browser's
 * print pipeline + the print stylesheet (matches the invoice approach).
 */
type Tab = "revenue" | "occupancy" | "balances" | "pnl" | "inventory" | "guests" | "tax" | "assets";

const TABS: { id: Tab; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "occupancy", label: "Occupancy" },
  { id: "balances", label: "Balances" },
  { id: "pnl", label: "P&L" },
  { id: "inventory", label: "Inventory" },
  { id: "guests", label: "Guests" },
  { id: "tax", label: "Tax / VAT" },
  { id: "assets", label: "Assets" },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Client-side CSV download (10.5). */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r.map((cell) => `"${String(cell).replaceAll(`"`, `""`)}"`).join(","),
    )
    .join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const kes = (cents: bigint) => formatKes(cents).replace("KES ", "");

export default function ReportsPage() {
  const { can, isLoading } = usePermissions();
  const [tab, setTab] = useState<Tab>("revenue");
  const [fromIso, setFromIso] = useState(isoDaysAgo(29));
  const [toIso, setToIso] = useState(isoDaysAgo(0));

  if (isLoading) return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  if (!can("Reports", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have reports permissions." />
      </div>
    );
  }

  const ranged = ["revenue", "occupancy", "pnl", "tax"].includes(tab);

  return (
    <section className="fade-in space-y-5 p-4 md:p-6 print-doc">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1 print:hidden">Administration</p>
          <h1 className="hero-title font-display text-headline-lg">Reports</h1>
          <p className="mt-1 text-body-lg text-text-muted">
            {ranged ? `${fromIso} → ${toIso}` : "Live snapshot"} · every figure traces to source records
          </p>
        </div>
        <Button variant="ghost" onClick={() => window.print()} className="print:hidden">
          <Printer className="size-4" aria-hidden="true" /> Print / PDF
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="seg" role="tablist" aria-label="Report">
          {TABS.map((t) => (
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
        {ranged && (
          <>
            <Input type="date" aria-label="From" value={fromIso} onChange={(e) => setFromIso(e.target.value)} className="w-40" />
            <span className="text-text-muted">→</span>
            <Input type="date" aria-label="To" value={toIso} onChange={(e) => setToIso(e.target.value)} className="w-40" />
          </>
        )}
      </div>

      {tab === "revenue" && <RevenueReport fromIso={fromIso} toIso={toIso} />}
      {tab === "occupancy" && <OccupancyReport fromIso={fromIso} toIso={toIso} />}
      {tab === "balances" && <BalancesReport />}
      {tab === "pnl" && <PnlReport fromIso={fromIso} toIso={toIso} />}
      {tab === "inventory" && <InventoryReport />}
      {tab === "guests" && <GuestsReport />}
      {tab === "tax" && <TaxReport fromIso={fromIso} toIso={toIso} />}
      {tab === "assets" && <AssetsReport />}
    </section>
  );
}

function Stat({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-label-caps uppercase text-text-muted">{label}</span>
      <span className={`kpi-value !text-xl text-text ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} className="print:hidden">
      <Download className="size-3.5" aria-hidden="true" /> CSV
    </Button>
  );
}

function RevenueReport({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const r = useQuery(api.reports.revenue, { fromIso, toIso });
  if (!r) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Total revenue" value={formatKes(r.totalCents)} />
        <Stat label="Payments" value={r.count} mono={false} />
      </div>
      {(
        [
          ["By day", r.byDay, "revenue-by-day"],
          ["By method", r.byMethod, "revenue-by-method"],
          ["By source", r.bySource, "revenue-by-source"],
        ] as const
      ).map(([title, rows, file]) => (
        <div key={title} className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-headline-sm text-text">{title}</h2>
            <ExportBtn
              onClick={() =>
                downloadCsv(`${file}-${fromIso}-${toIso}.csv`, [
                  [title === "By day" ? "Day" : title.slice(3), "KES"],
                  ...rows.map((x) => [x.key, kes(x.cents)]),
                ])
              }
            />
          </div>
          <Table>
            <TBody>
              {rows.length === 0 && (
                <TR>
                  <TD className="text-text-muted">No payments in range.</TD>
                </TR>
              )}
              {rows.map((x) => (
                <TR key={x.key}>
                  <TD>{x.key.replaceAll("_", " ")}</TD>
                  <TD className="text-right font-mono">{formatKes(x.cents)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ))}
    </div>
  );
}

function OccupancyReport({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const o = useQuery(api.reports.occupancy, { fromIso, toIso });
  if (!o) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Average occupancy" value={`${o.avgPct}%`} />
        <Stat label="Rooms" value={o.rooms} />
        <Stat label="Stays starting" value={o.stays} />
        <Stat label="Avg length of stay" value={`${o.avgLengthOfStay} nights`} mono={false} />
      </div>
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-headline-sm text-text">Daily occupancy</h2>
          <ExportBtn
            onClick={() =>
              downloadCsv(`occupancy-${fromIso}-${toIso}.csv`, [
                ["Day", "Occupied", "Pct"],
                ...o.days.map((d) => [d.day, d.occupied, d.pct]),
              ])
            }
          />
        </div>
        <div className="flex h-36 items-end gap-px overflow-x-auto">
          {o.days.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.pct}%`}
              className="min-w-1.5 flex-1 rounded-t bg-[linear-gradient(180deg,var(--primary),rgba(20,184,166,0.3))]"
              style={{ height: `${Math.max(2, d.pct)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BalancesReport() {
  const b = useQuery(api.reports.balances, {});
  if (!b) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Outstanding (owed to us)" value={formatKes(b.totalCents)} />
        <Stat label="Open accounts" value={b.rows.length} mono={false} />
      </div>
      <div className="card !p-0">
        <div className="flex items-center justify-between p-3 pb-0">
          <h2 className="font-display text-headline-sm text-text">Open balances</h2>
          <ExportBtn
            onClick={() =>
              downloadCsv("balances.csv", [
                ["Reference", "Guest", "Status", "Check-out", "Balance KES"],
                ...b.rows.map((r) => [r.reference, r.guestName, r.status, r.checkOutDate, kes(r.balanceCents)]),
              ])
            }
          />
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Reference</TH>
              <TH>Guest</TH>
              <TH>Status</TH>
              <TH className="text-right">Balance</TH>
            </TR>
          </THead>
          <TBody>
            {b.rows.length === 0 && (
              <TR>
                <TD colSpan={4} className="text-center text-text-muted">
                  Everything is settled.
                </TD>
              </TR>
            )}
            {b.rows.map((r) => (
              <TR key={r.reference}>
                <TD className="font-mono">{r.reference}</TD>
                <TD>{r.guestName}</TD>
                <TD>
                  <StatusChip status={r.status === "checked_in" ? "info" : "warning"}>
                    {r.status.replaceAll("_", " ")}
                  </StatusChip>
                </TD>
                <TD className="text-right font-mono">{formatKes(r.balanceCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function PnlReport({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const p = useQuery(api.reports.pnl, { fromIso, toIso });
  if (!p) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Revenue (confirmed)" value={formatKes(p.revenueCents)} />
        <Stat label="Purchases (received)" value={formatKes(p.purchasesCents)} />
        <Stat label="Gross result" value={formatKes(p.grossCents)} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-body-md text-text-muted">
          Simple trading view: confirmed payments minus received purchase orders. Payroll and
          other operating expenses are out of scope for R1 data.
        </p>
        <ExportBtn
          onClick={() =>
            downloadCsv(`pnl-${fromIso}-${toIso}.csv`, [
              ["Line", "KES"],
              ["Revenue", kes(p.revenueCents)],
              ["Purchases", kes(p.purchasesCents)],
              ["Gross", kes(p.grossCents)],
            ])
          }
        />
      </div>
    </div>
  );
}

function InventoryReport() {
  const inv = useQuery(api.reports.inventoryReport, {});
  if (!inv) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Stock value (cost)" value={formatKes(inv.stockValueCents)} />
        <Stat label="Products" value={inv.products} mono={false} />
        <Stat label="Movements" value={inv.movements} mono={false} />
        <Stat label="Low stock" value={inv.low.length} mono={false} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-headline-sm text-text">Low stock</h2>
            <ExportBtn
              onClick={() =>
                downloadCsv("low-stock.csv", [
                  ["Product", "On hand", "Reorder at"],
                  ...inv.low.map((l) => [l.name, l.stockQty, l.reorderLevel]),
                ])
              }
            />
          </div>
          {inv.low.length === 0 ? (
            <p className="text-body-md text-text-muted">Nothing below reorder level.</p>
          ) : (
            inv.low.map((l) => (
              <p key={l.name} className="text-body-md text-text">
                {l.name} — <span className="font-mono">{l.stockQty}</span> (reorder at {l.reorderLevel})
              </p>
            ))
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 font-display text-headline-sm text-text">Top usage</h2>
          {inv.topUsage.length === 0 ? (
            <p className="text-body-md text-text-muted">No usage recorded yet.</p>
          ) : (
            inv.topUsage.map((u) => (
              <p key={u.name} className="text-body-md text-text">
                {u.name} — <span className="font-mono">{u.qty}</span> used
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function GuestsReport() {
  const g = useQuery(api.reports.guestAnalytics, {});
  if (!g) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Guests" value={g.guests} mono={false} />
        <Stat label="Returning" value={g.returning} mono={false} />
        <Stat
          label="Return rate"
          value={g.guests ? `${Math.round((g.returning / g.guests) * 100)}%` : "0%"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-headline-sm text-text">Top spenders</h2>
            <ExportBtn
              onClick={() =>
                downloadCsv("top-spenders.csv", [
                  ["Guest", "KES"],
                  ...g.topSpenders.map((s) => [s.name, kes(s.cents)]),
                ])
              }
            />
          </div>
          {g.topSpenders.length === 0 ? (
            <p className="text-body-md text-text-muted">No confirmed payments yet.</p>
          ) : (
            g.topSpenders.map((s, i) => (
              <p key={s.name + i} className="flex justify-between text-body-md text-text">
                <span>{s.name}</span>
                <span className="font-mono">{formatKes(s.cents)}</span>
              </p>
            ))
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 font-display text-headline-sm text-text">Nationality mix</h2>
          {g.nationality.map((n) => (
            <p key={n.key} className="flex justify-between text-body-md text-text">
              <span>{n.key}</span>
              <span className="font-mono">{n.count}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaxReport({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const t = useQuery(api.reports.taxVat, { fromIso, toIso });
  if (!t) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Rate" value={`${Number(t.rateBps) / 100}%`} />
        <Stat label="Gross charges" value={formatKes(t.grossCents)} />
        <Stat label="VAT portion" value={formatKes(t.vatCents)} />
        <Stat label="Net of VAT" value={formatKes(t.netCents)} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-body-md text-text-muted">
          Charges are posted VAT-inclusive; the VAT portion is decomposed at the currently
          active rate.
        </p>
        <ExportBtn
          onClick={() =>
            downloadCsv(`vat-${fromIso}-${toIso}.csv`, [
              ["Line", "KES"],
              ["Gross charges", kes(t.grossCents)],
              ["VAT", kes(t.vatCents)],
              ["Net", kes(t.netCents)],
            ])
          }
        />
      </div>
    </div>
  );
}

function AssetsReport() {
  const a = useQuery(api.reports.assetsReport, {});
  if (!a) return <p className="text-body-md text-text-muted">Loading…</p>;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat label="Registered assets" value={a.assets} mono={false} />
      <Stat label="Damage reports" value={a.damageReports} mono={false} />
      <Stat label="Open damage" value={a.openDamage} mono={false} />
      <Stat label="Damage charged" value={formatKes(a.chargedCents)} />
      <Stat label="Open maintenance" value={a.maintenanceOpen} mono={false} />
    </div>
  );
}
