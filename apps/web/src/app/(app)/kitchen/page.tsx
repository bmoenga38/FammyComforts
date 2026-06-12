"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { usePermissions } from "@/lib/use-permissions";
import { kesToCents, formatKes } from "@/lib/money";
import { Button, EmptyState, Input, StatusChip } from "@/components/ui";
import { ChefHat, Plus, UtensilsCrossed, BanknoteIcon } from "lucide-react";

/**
 * Kitchen & restaurant workspace (Epic 9): live kitchen display with status
 * lanes (9.3 — realtime via Convex subscriptions), the order composer across
 * channels (9.2), settlement to room or separate payment (9.4), today's
 * revenue + top sellers (9.5, Restaurant managers), and the menu manager
 * (9.1, optionally linked to inventory products).
 */
type Order = FunctionReturnType<typeof api.restaurant.board>[number];

const LANES = [
  { id: "pending", label: "New", tone: "warning" },
  { id: "preparing", label: "Preparing", tone: "info" },
  { id: "ready", label: "Ready", tone: "success" },
  { id: "served", label: "Served — settle", tone: "premium" },
] as const;

const CHANNELS = ["dine_in", "room_service", "takeaway", "bar"] as const;

export default function KitchenPage() {
  const { can, isLoading } = usePermissions();
  const orders = useQuery(api.restaurant.board, can("Restaurant", "read") ? {} : "skip");

  if (isLoading) return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  if (!can("Restaurant", "read")) {
    return (
      <div className="p-6">
        <EmptyState title="No access" description="You don't have restaurant permissions." />
      </div>
    );
  }

  const canWrite = can("Restaurant", "write");
  const open = (orders ?? []).filter(
    (o) => !["paid", "cancelled"].includes(o.status),
  );

  return (
    <section className="fade-in space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1">Kitchen</p>
        <h1 className="hero-title font-display text-headline-lg">Orders</h1>
        <p className="mt-1 text-body-lg text-text-muted">
          {open.length} active order{open.length === 1 ? "" : "s"} — live board
        </p>
      </header>

      {can("Restaurant", "manage") && <RevenueCard />}
      {canWrite && <OrderComposer />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((lane) => {
          const inLane = (orders ?? []).filter((o) => o.status === lane.id);
          return (
            <div key={lane.id} className="card !p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-headline-sm text-text">{lane.label}</h2>
                <StatusChip status={lane.tone}>{inLane.length}</StatusChip>
              </div>
              <div className="space-y-2.5">
                {inLane.length === 0 && (
                  <p className="py-3 text-center text-body-md text-text-muted">—</p>
                )}
                {inLane.map((o) => (
                  <OrderCard key={o.orderId} order={o} canWrite={canWrite} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {can("Restaurant", "manage") && <MenuManager />}
    </section>
  );
}

function OrderCard({ order: o, canWrite }: { order: Order; canWrite: boolean }) {
  const setStatus = useMutation(api.restaurant.setOrderStatus);
  const chargeToRoom = useMutation(api.restaurant.chargeToRoom);
  const payOrder = useMutation(api.restaurant.payOrder);
  const [ref, setRef] = useState("");
  const [provider, setProvider] = useState<"cash" | "card" | "mpesa_manual">("cash");
  const [receipt, setReceipt] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const advance =
    o.status === "pending" ? "preparing" : o.status === "preparing" ? "ready" : "served";

  return (
    <div className="rounded-card border border-[var(--hairline)] bg-bg-input/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-text">{o.number}</span>
        <span className="text-[11px] uppercase text-text-dim">
          {o.channel.replaceAll("_", " ")}
          {o.tableOrRoom ? ` · ${o.tableOrRoom}` : ""}
        </span>
      </div>
      <p className="my-1 text-body-md text-text-muted">
        {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-text">{formatKes(o.totalCents)}</span>
        {canWrite && o.status !== "served" && (
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => setStatus({ orderId: o.orderId, status: advance })}>
              → {advance}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatus({ orderId: o.orderId, status: "cancelled" })}
            >
              ✕
            </Button>
          </div>
        )}
      </div>
      {canWrite && o.status === "served" && (
        <div className="mt-2 space-y-1.5 border-t border-[var(--hairline)] pt-2">
          <div className="flex gap-1.5">
            <Input
              aria-label="Booking reference"
              placeholder="BK-… ref"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="!py-1.5 flex-1 font-mono text-xs"
            />
            <Button
              size="sm"
              disabled={!ref.trim()}
              onClick={() =>
                chargeToRoom({ orderId: o.orderId, bookingReference: ref })
                  .then(() => setErr(null))
                  .catch((e) => setErr(String(e.message ?? e)))
              }
            >
              Charge room
            </Button>
          </div>
          <div className="flex gap-1.5">
            <select
              aria-label="Payment method"
              className="ctrl flex-1 !py-1.5 text-xs"
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
            >
              <option value="cash">cash</option>
              <option value="card">card</option>
              <option value="mpesa_manual">M-Pesa ref</option>
            </select>
            {provider === "mpesa_manual" && (
              <Input
                aria-label="M-Pesa receipt"
                placeholder="Receipt"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                className="!py-1.5 w-24 font-mono text-xs"
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                payOrder({
                  orderId: o.orderId,
                  provider,
                  receiptNumber: receipt || undefined,
                })
                  .then(() => setErr(null))
                  .catch((e) => setErr(String(e.message ?? e)))
              }
            >
              Pay now
            </Button>
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}

/** 9.2 — compose an order from active menu items. */
function OrderComposer() {
  const menu = useQuery(api.restaurant.menu, {});
  const createOrder = useMutation(api.restaurant.createOrder);
  const [openForm, setOpenForm] = useState(false);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("dine_in");
  const [tableOrRoom, setTableOrRoom] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  const items = (menu ?? [])
    .filter((m) => m.active)
    .map((m) => ({ ...m, n: Number(qty[m.menuItemId] ?? 0) }));
  const totalCents = items.reduce(
    (sum, m) => sum + m.priceCents * BigInt(Math.max(0, Math.round(m.n))),
    0n,
  );

  const submit = async () => {
    const lines = items
      .filter((m) => m.n > 0)
      .map((m) => ({ menuItemId: m.menuItemId, qty: Math.round(m.n) }));
    if (lines.length === 0) return;
    const r = await createOrder({
      channel,
      tableOrRoom: tableOrRoom || undefined,
      items: lines,
    });
    setNote(`Order ${r.number} placed — ${formatKes(r.totalCents)}.`);
    setQty({});
    setTableOrRoom("");
    setOpenForm(false);
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-headline-sm text-text">
          <UtensilsCrossed className="size-4" aria-hidden="true" /> New order
        </h2>
        <Button size="sm" variant={openForm ? "ghost" : "primary"} onClick={() => setOpenForm(!openForm)}>
          <Plus className="size-4" aria-hidden="true" /> {openForm ? "Close" : "Take order"}
        </Button>
      </div>
      {note && !openForm && <p className="text-body-md text-primary">{note}</p>}
      {openForm && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="seg" role="tablist" aria-label="Order channel">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={channel === c}
                  className={`seg-btn ${channel === c ? "active" : ""}`}
                  onClick={() => setChannel(c)}
                >
                  {c.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <Input
              aria-label="Table or room"
              placeholder={channel === "room_service" ? "Room no." : "Table no."}
              value={tableOrRoom}
              onChange={(e) => setTableOrRoom(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {items.map((m) => (
              <div key={m.menuItemId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-body-md text-text">
                  {m.name}{" "}
                  <span className="font-mono text-text-dim">{formatKes(m.priceCents)}</span>
                </span>
                <Input
                  aria-label={`${m.name} quantity`}
                  inputMode="numeric"
                  placeholder="0"
                  value={qty[m.menuItemId] ?? ""}
                  onChange={(e) => setQty({ ...qty, [m.menuItemId]: e.target.value })}
                  className="w-16 text-right"
                />
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-body-md text-text-muted">
                No menu items yet — add them below (manager).
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-text">{formatKes(totalCents)}</span>
            <Button disabled={totalCents === 0n} onClick={submit}>
              Place order
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** 9.5 — today's settled revenue + top sellers. */
function RevenueCard() {
  const today = new Date().toISOString().slice(0, 10);
  const revenue = useQuery(api.restaurant.revenue, { fromIso: today, toIso: today });
  if (!revenue) return null;
  return (
    <div className="card flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="kpi-icon bg-badge-premium text-badge-premium-fg">
        <BanknoteIcon className="size-5" />
      </span>
      <div>
        <span className="text-label-caps block uppercase text-text-muted">Restaurant today</span>
        <span className="kpi-value font-mono !text-xl text-text">
          {formatKes(revenue.totalCents)}
        </span>
      </div>
      <div className="text-body-md text-text-muted">
        {revenue.orders} settled order{revenue.orders === 1 ? "" : "s"}
        {revenue.topSellers[0] && (
          <>
            {" "}
            · top: {revenue.topSellers[0].name} ×{revenue.topSellers[0].qty}
          </>
        )}
      </div>
    </div>
  );
}

/** 9.1 — menu manager with optional inventory links. */
function MenuManager() {
  const menu = useQuery(api.restaurant.menu, {});
  const products = useQuery(api.inventory.products, {});
  const createMenuItem = useMutation(api.restaurant.createMenuItem);
  const setActive = useMutation(api.restaurant.setMenuItemActive);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("food");
  const [linkProduct, setLinkProduct] = useState("");
  const [linkQty, setLinkQty] = useState("1");

  return (
    <div className="card space-y-3">
      <h2 className="flex items-center gap-2 font-display text-headline-sm text-text">
        <ChefHat className="size-4" aria-hidden="true" /> Menu
      </h2>
      <div className="divide-rows">
        {menu?.map((m) => (
          <div key={m.menuItemId} className="list-row !px-1">
            <div className="min-w-0 flex-1">
              <p className={`text-text ${m.active ? "" : "opacity-50 line-through"}`}>
                {m.name}
                <span className="ml-2 text-[11px] uppercase text-text-dim">{m.category}</span>
              </p>
              {m.ingredients.length > 0 && (
                <p className="text-[11px] text-text-dim">
                  uses {m.ingredients.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                </p>
              )}
            </div>
            <span className="font-mono text-text">{formatKes(m.priceCents)}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActive({ menuItemId: m.menuItemId, active: !m.active })}
            >
              {m.active ? "86 it" : "Restore"}
            </Button>
          </div>
        ))}
        {menu?.length === 0 && (
          <p className="py-2 text-body-md text-text-muted">No menu items yet.</p>
        )}
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await createMenuItem({
            name,
            category,
            priceCents: kesToCents(price || "0"),
            ingredients: linkProduct
              ? [
                  {
                    productId: linkProduct as NonNullable<
                      typeof products
                    >[number]["productId"],
                    qty: Number(linkQty) || 1,
                  },
                ]
              : undefined,
          });
          setName("");
          setPrice("");
          setLinkProduct("");
        }}
      >
        <Input aria-label="Item name" placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} className="w-44" />
        <select aria-label="Category" className="ctrl" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="food">food</option>
          <option value="drink">drink</option>
        </select>
        <Input aria-label="Price KES" placeholder="Price KES" value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" />
        <select
          aria-label="Linked inventory product"
          className="ctrl"
          value={linkProduct}
          onChange={(e) => setLinkProduct(e.target.value)}
        >
          <option value="">No inventory link</option>
          {products
            ?.filter((p) => p.active)
            .map((p) => (
              <option key={p.productId} value={p.productId}>
                uses {p.name}
              </option>
            ))}
        </select>
        {linkProduct && (
          <Input aria-label="Qty per serving" placeholder="Qty/serve" value={linkQty} onChange={(e) => setLinkQty(e.target.value)} className="w-24" />
        )}
        <Button type="submit" disabled={!name.trim() || !price.trim()}>
          Add item
        </Button>
      </form>
    </div>
  );
}
