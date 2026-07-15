"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import type { Id } from "@fammycomforts/backend/convex/_generated/dataModel";
import { formatKes } from "@/lib/money";
import { Button, EmptyState } from "@/components/ui";
import { UtensilsCrossed, Minus, Plus, CheckCircle2 } from "lucide-react";

/**
 * Customer food ordering (R3). An authenticated guest browses the active menu,
 * builds a cart, and places a room-service order that drops straight into the
 * staff Kitchen board (visible to kitchen, ops, and admin). Below, the guest
 * tracks their own orders live as the kitchen advances them.
 */
const STATUS_TONE: Record<string, string> = {
  pending: "bg-badge-warning text-badge-warning-fg",
  preparing: "bg-badge-info text-badge-info-fg",
  ready: "bg-badge-success text-badge-success-fg",
  served: "bg-badge-success text-badge-success-fg",
  paid: "bg-badge-premium text-badge-premium-fg",
  cancelled: "bg-badge-danger text-badge-danger-fg",
};

export default function OrderPage() {
  const menu = useQuery(api.customerKitchen.menu);
  const myOrders = useQuery(api.customerKitchen.myOrders);
  const place = useMutation(api.customerKitchen.placeOrder);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);

  const totalCents = useMemo(() => {
    if (!menu) return 0n;
    let t = 0n;
    for (const m of menu) t += m.priceCents * BigInt(cart[m.menuItemId] ?? 0);
    return t;
  }, [menu, cart]);

  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const setQty = (id: string, delta: number) =>
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + delta);
      const copy = { ...c };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const submit = async () => {
    setError(null);
    setPlaced(null);
    const items = Object.entries(cart).map(([menuItemId, qty]) => ({
      menuItemId: menuItemId as Id<"menuItems">,
      qty,
    }));
    if (items.length === 0) return setError("Add at least one item.");
    setBusy(true);
    try {
      const res = await place({ tableOrRoom: room.trim() || undefined, items });
      setPlaced(res.number);
      setCart({});
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fade-in mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <header>
        <p className="eyebrow mb-1 flex items-center gap-1.5">
          <UtensilsCrossed className="size-4" aria-hidden="true" /> Room service
        </p>
        <h1 className="hero-title font-display text-headline-lg">Order food</h1>
        <p className="mt-1 text-body-lg text-text-muted">
          Freshly made and brought to your room — the kitchen sees it instantly.
        </p>
      </header>

      {placed && (
        <div className="card flex items-center gap-3 border-primary/40">
          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-body-md text-text">
            Order <b className="font-mono">{placed}</b> sent to the kitchen. Track it below.
          </p>
        </div>
      )}

      {/* Menu */}
      <div className="card">
        <h2 className="mb-2 font-display text-headline-sm text-text">Menu</h2>
        {menu === undefined ? (
          <p className="py-3 text-body-md text-text-muted">Loading…</p>
        ) : menu.length === 0 ? (
          <p className="py-3 text-body-md text-text-muted">No menu items available right now.</p>
        ) : (
          <div className="divide-rows">
            {menu.map((m) => {
              const qty = cart[m.menuItemId] ?? 0;
              return (
                <div key={m.menuItemId} className="list-row !px-1 !py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{m.name}</p>
                    <p className="text-body-md text-text-muted">
                      {m.category ? `${m.category} · ` : ""}
                      {formatKes(m.priceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {qty > 0 && (
                      <>
                        <button
                          type="button"
                          aria-label={`Remove one ${m.name}`}
                          className="icon-btn size-8"
                          onClick={() => setQty(m.menuItemId, -1)}
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </button>
                        <span className="w-5 text-center font-mono text-sm text-text">{qty}</span>
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={`Add one ${m.name}`}
                      className="icon-btn size-8"
                      onClick={() => setQty(m.menuItemId, 1)}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart / checkout */}
      {itemCount > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-body-md text-text-muted">{itemCount} item(s)</span>
            <span className="font-mono text-headline-sm text-primary">{formatKes(totalCents)}</span>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-muted">
            Room / table
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. 204"
              className="w-full rounded-ctrl border border-border bg-bg-input px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus-visible:border-primary focus-visible:outline-none"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button fullWidth disabled={busy} onClick={submit}>
            {busy ? "Sending…" : `Place order · ${formatKes(totalCents)}`}
          </Button>
        </div>
      )}

      {/* My orders */}
      <div>
        <h2 className="mb-2 font-display text-headline-sm text-text">My orders</h2>
        {myOrders === undefined ? (
          <p className="text-body-md text-text-muted">Loading…</p>
        ) : myOrders.length === 0 ? (
          <EmptyState title="No orders yet" description="Your food orders will show here." />
        ) : (
          <div className="space-y-2">
            {myOrders.map((o) => (
              <div key={o.orderId} className="card card-hover flex items-center gap-3 !p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">
                    <span className="font-mono">{o.number}</span> ·{" "}
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </p>
                  <p className="text-body-md text-text-muted">
                    {o.tableOrRoom ? `Room ${o.tableOrRoom} · ` : ""}
                    {formatKes(o.totalCents)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${STATUS_TONE[o.status] ?? "bg-bg-input text-text-muted"}`}
                >
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
