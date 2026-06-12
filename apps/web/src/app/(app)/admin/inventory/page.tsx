"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { usePermissions } from "@/lib/use-permissions";
import { kesToCents, formatKes } from "@/lib/money";
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
import { Boxes, Truck, ClipboardList, History } from "lucide-react";

/**
 * Inventory & Procurement workspace (Epic 8): product catalog with live
 * on-hand + low-stock flags (8.1/8.5), stocktake mode (8.4), suppliers +
 * purchase orders with receive-restock (8.2), and the movements audit trail
 * (8.3). Stock changes go through the audited backend gateway only.
 */
type Tab = "products" | "purchases" | "movements";

export default function InventoryAdminPage() {
  const { can, isLoading } = usePermissions();
  const [tab, setTab] = useState<Tab>("products");

  if (isLoading) return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  if (!can("Inventory", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have inventory permissions." />
      </div>
    );
  }

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">Administration</p>
        <h1 className="hero-title font-display text-headline-lg">Inventory &amp; purchases</h1>
      </header>

      <div className="seg" role="tablist" aria-label="Inventory sections">
        {(
          [
            ["products", "Products & stock", Boxes],
            ["purchases", "Suppliers & POs", Truck],
            ["movements", "Movements", History],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`seg-btn ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon className="size-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsSection canManage={can("Inventory", "manage")} />}
      {tab === "purchases" &&
        (can("Purchases", "read") ? (
          <PurchasesSection
            canWrite={can("Purchases", "write")}
            canManage={can("Purchases", "manage")}
          />
        ) : (
          <EmptyState title="No access" description="You don't have purchases permissions." />
        ))}
      {tab === "movements" && <MovementsSection />}
    </section>
  );
}

/* ───────────── 8.1 + 8.4 + 8.5: products, stocktake, usage ───────────── */

function ProductsSection({ canManage }: { canManage: boolean }) {
  const products = useQuery(api.inventory.products, {});
  const createProduct = useMutation(api.inventory.createProduct);
  const recordUsage = useMutation(api.inventory.recordUsage);
  const stocktake = useMutation(api.inventory.stocktake);

  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", unit: "pcs", cost: "", qty: "", reorder: "" });
  const [note, setNote] = useState<string | null>(null);

  if (products === undefined) {
    return <p className="text-body-md text-text-muted">Loading products…</p>;
  }
  const lowCount = products.filter((p) => p.low && p.active).length;

  const finishStocktake = async () => {
    const entries = Object.entries(counts).filter(([, v]) => v !== "");
    if (entries.length === 0) return setCounting(false);
    const r = await stocktake({
      counts: entries.map(([productId, v]) => ({
        productId: productId as Parameters<typeof recordUsage>[0]["productId"],
        countedQty: Number(v),
      })),
    });
    setNote(`Stocktake done — ${r.counted} counted, ${r.variances} variance(s) posted.`);
    setCounts({});
    setCounting(false);
  };

  return (
    <div className="space-y-4">
      {lowCount > 0 && (
        <div className="card !border-[rgba(245,158,11,.4)] !bg-[rgba(245,158,11,.08)] !p-3 text-body-md text-text">
          ⚠ {lowCount} product{lowCount > 1 ? "s" : ""} at or below reorder level.
        </div>
      )}
      {note && <p className="text-body-md text-primary">{note}</p>}

      <div className="card !p-0">
        <Table>
          <THead>
            <TR>
              <TH>Product</TH>
              <TH>Unit</TH>
              <TH className="text-right">Cost</TH>
              <TH className="text-right">{counting ? "Counted" : "On hand"}</TH>
              <TH className="text-right">Reorder at</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {products.length === 0 && (
              <TR>
                <TD colSpan={6} className="text-center text-text-muted">
                  No products yet.
                </TD>
              </TR>
            )}
            {products.map((p) => (
              <TR key={p.productId}>
                <TD>
                  <span className={p.active ? "" : "opacity-50 line-through"}>{p.name}</span>
                  {p.category && (
                    <span className="ml-2 text-[11px] uppercase text-text-dim">{p.category}</span>
                  )}
                </TD>
                <TD>{p.unit}</TD>
                <TD className="text-right font-mono">{formatKes(p.costCents)}</TD>
                <TD className="text-right font-mono">
                  {counting ? (
                    <Input
                      aria-label={`${p.name} counted qty`}
                      inputMode="numeric"
                      placeholder={String(p.stockQty)}
                      value={counts[p.productId] ?? ""}
                      onChange={(e) =>
                        setCounts({ ...counts, [p.productId]: e.target.value })
                      }
                      className="w-20 text-right"
                    />
                  ) : (
                    p.stockQty
                  )}
                </TD>
                <TD className="text-right font-mono">{p.reorderLevel}</TD>
                <TD className="text-right">
                  {p.low && p.active && <StatusChip status="danger">low</StatusChip>}
                  {!counting && p.active && p.stockQty > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const qty = Number(
                          window.prompt(`Use how many ${p.unit} of ${p.name}?`, "1") ?? "",
                        );
                        if (qty > 0) await recordUsage({ productId: p.productId, qty });
                      }}
                    >
                      Use
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {counting ? (
            <>
              <Button onClick={finishStocktake}>
                <ClipboardList className="size-4" aria-hidden="true" /> Finalize stocktake
              </Button>
              <Button variant="ghost" onClick={() => { setCounting(false); setCounts({}); }}>
                Cancel
              </Button>
              <p className="text-body-md text-text-muted">
                Enter counted quantities — blanks keep the system figure.
              </p>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setCounting(true)}>
              <ClipboardList className="size-4" aria-hidden="true" /> Start stocktake
            </Button>
          )}
        </div>
      )}

      {canManage && !counting && (
        <form
          className="card flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await createProduct({
              name: form.name,
              unit: form.unit || "pcs",
              costCents: kesToCents(form.cost || "0"),
              openingQty: form.qty ? Number(form.qty) : undefined,
              reorderLevel: form.reorder ? Number(form.reorder) : 0,
            });
            setForm({ name: "", unit: "pcs", cost: "", qty: "", reorder: "" });
          }}
        >
          <Input aria-label="Product name" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-44" />
          <Input aria-label="Unit" placeholder="Unit (pcs/kg/ltr)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-32" />
          <Input aria-label="Cost KES" placeholder="Cost KES" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="w-28" />
          <Input aria-label="Opening qty" placeholder="Opening qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="w-28" />
          <Input aria-label="Reorder level" placeholder="Reorder at" value={form.reorder} onChange={(e) => setForm({ ...form, reorder: e.target.value })} className="w-28" />
          <Button type="submit" disabled={!form.name.trim()}>
            Add product
          </Button>
        </form>
      )}
    </div>
  );
}

/* ───────────── 8.2: suppliers + purchase orders ───────────── */

type PO = FunctionReturnType<typeof api.inventory.purchaseOrders>[number];

function PurchasesSection({ canWrite, canManage }: { canWrite: boolean; canManage: boolean }) {
  const suppliers = useQuery(api.inventory.suppliers, {});
  const products = useQuery(api.inventory.products, {});
  const pos = useQuery(api.inventory.purchaseOrders, {});
  const createSupplier = useMutation(api.inventory.createSupplier);
  const createPO = useMutation(api.inventory.createPurchaseOrder);
  const receivePO = useMutation(api.inventory.receivePurchaseOrder);
  const cancelPO = useMutation(api.inventory.cancelPurchaseOrder);

  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [poSupplier, setPoSupplier] = useState("");
  const [lines, setLines] = useState<Record<string, string>>({});

  const submitPO = async () => {
    const items = Object.entries(lines)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => ({
        productId: productId as NonNullable<typeof products>[number]["productId"],
        qty: Number(qty),
      }));
    if (!poSupplier || items.length === 0) return;
    await createPO({
      supplierId: poSupplier as Parameters<typeof createPO>[0]["supplierId"],
      items,
    });
    setLines({});
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="card space-y-2">
          <h2 className="font-display text-headline-sm text-text">Suppliers</h2>
          {suppliers?.length === 0 && (
            <p className="text-body-md text-text-muted">No suppliers yet.</p>
          )}
          <ul className="divide-rows">
            {suppliers?.map((s) => (
              <li key={s.supplierId} className="list-row !px-1">
                <span className="flex-1 text-text">{s.name}</span>
                <span className="font-mono text-body-md text-text-muted">{s.phone}</span>
              </li>
            ))}
          </ul>
          {canManage && (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await createSupplier({ name: supName, phone: supPhone || undefined });
                setSupName("");
                setSupPhone("");
              }}
            >
              <Input aria-label="Supplier name" placeholder="Supplier name" value={supName} onChange={(e) => setSupName(e.target.value)} className="w-44" />
              <Input aria-label="Supplier phone" placeholder="Phone" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} className="w-36" />
              <Button type="submit" disabled={!supName.trim()}>
                Add
              </Button>
            </form>
          )}
        </div>

        {canWrite && (
          <div className="card space-y-2">
            <h2 className="font-display text-headline-sm text-text">New purchase order</h2>
            <select
              aria-label="PO supplier"
              className="ctrl"
              value={poSupplier}
              onChange={(e) => setPoSupplier(e.target.value)}
            >
              <option value="">Supplier…</option>
              {suppliers?.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {products
                ?.filter((p) => p.active)
                .map((p) => (
                  <div key={p.productId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-body-md text-text">
                      {p.name}{" "}
                      <span className="text-text-dim">({formatKes(p.costCents)}/{p.unit})</span>
                    </span>
                    <Input
                      aria-label={`${p.name} order qty`}
                      inputMode="numeric"
                      placeholder="0"
                      value={lines[p.productId] ?? ""}
                      onChange={(e) => setLines({ ...lines, [p.productId]: e.target.value })}
                      className="w-20 text-right"
                    />
                  </div>
                ))}
            </div>
            <Button disabled={!poSupplier} onClick={submitPO}>
              <Truck className="size-4" aria-hidden="true" /> Place order
            </Button>
          </div>
        )}
      </div>

      <div className="card space-y-2">
        <h2 className="font-display text-headline-sm text-text">Purchase orders</h2>
        {pos?.length === 0 && <p className="text-body-md text-text-muted">No POs yet.</p>}
        <div className="divide-rows">
          {pos?.map((po: PO) => (
            <div key={po.poId} className="space-y-1 py-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 font-semibold text-text">{po.supplierName}</span>
                <span className="font-mono text-text">{formatKes(po.totalCents)}</span>
                <StatusChip
                  status={
                    po.status === "received"
                      ? "success"
                      : po.status === "cancelled"
                        ? "danger"
                        : "warning"
                  }
                >
                  {po.status}
                </StatusChip>
              </div>
              <p className="text-body-md text-text-muted">
                {po.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}
              </p>
              {canWrite && po.status === "ordered" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => receivePO({ poId: po.poId })}>
                    Receive → restock
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cancelPO({ poId: po.poId })}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── 8.3: movements audit trail ───────────── */

function MovementsSection() {
  const movements = useQuery(api.inventory.movements, {});
  if (movements === undefined) {
    return <p className="text-body-md text-text-muted">Loading movements…</p>;
  }
  return (
    <div className="card !p-0">
      <Table>
        <THead>
          <TR>
            <TH>When</TH>
            <TH>Product</TH>
            <TH className="text-right">Δ Qty</TH>
            <TH>Reason</TH>
            <TH>By</TH>
          </TR>
        </THead>
        <TBody>
          {movements.length === 0 && (
            <TR>
              <TD colSpan={5} className="text-center text-text-muted">
                No stock movements yet.
              </TD>
            </TR>
          )}
          {movements.map((m) => (
            <TR key={m.movementId}>
              <TD className="font-mono text-body-md">
                {new Date(m.at).toLocaleString("en-KE", {
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TD>
              <TD>{m.productName}</TD>
              <TD
                className={`text-right font-mono ${m.deltaQty > 0 ? "text-primary" : "text-text"}`}
              >
                {m.deltaQty > 0 ? `+${m.deltaQty}` : m.deltaQty}
              </TD>
              <TD>{m.reason}</TD>
              <TD className="text-text-muted">{m.actorName ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
