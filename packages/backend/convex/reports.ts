import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { nightsBetween, addDaysIso, activeTaxBps } from "./lib/bookingDomain";
import { bookingBalanceCents } from "./lib/ledger";

/**
 * Reporting (Epic 10, Stories 10.2–10.4). Every figure is computed live from
 * source records (payments, ledger, bookings, POs, movements) — there are no
 * stored aggregates to drift (NFR12: every number traces to rows the audit
 * trail covers). All queries gate on Reports:read. Date ranges are inclusive
 * ISO days, capped to 366 days. CSV/PDF export is client-side (10.5): CSV from
 * these payloads, PDF via the print stylesheet.
 */

const dayMs = 86_400_000;

function rangeMs(fromIso: string, toIso: string): { from: number; to: number } {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`) + dayMs;
  if (Number.isNaN(from) || Number.isNaN(to) || from >= to) {
    throw new Error("Invalid date range.");
  }
  if ((to - from) / dayMs > 366) throw new Error("Range is capped at 366 days.");
  return { from, to };
}

/** 10.2 — revenue by day / method / source (confirmed payments). */
export const revenue = query({
  args: { fromIso: v.string(), toIso: v.string() },
  handler: async (ctx, { fromIso, toIso }) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    const { from, to } = rangeMs(fromIso, toIso);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const inRange = payments.filter(
      (p) => p.status === "confirmed" && p.paidAt && p.paidAt >= from && p.paidAt < to,
    );
    let totalCents = 0n;
    const byDay = new Map<string, bigint>();
    const byMethod = new Map<string, bigint>();
    const bySource = new Map<string, bigint>();
    for (const p of inRange) {
      totalCents += p.amountCents;
      const day = new Date(p.paidAt!).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0n) + p.amountCents);
      byMethod.set(p.provider, (byMethod.get(p.provider) ?? 0n) + p.amountCents);
      const booking = p.bookingId ? await ctx.db.get(p.bookingId) : null;
      const source = booking?.source ?? "restaurant";
      bySource.set(source, (bySource.get(source) ?? 0n) + p.amountCents);
    }
    const toRows = (m: Map<string, bigint>) =>
      [...m.entries()].sort().map(([key, cents]) => ({ key, cents }));
    return {
      totalCents,
      count: inRange.length,
      byDay: toRows(byDay),
      byMethod: toRows(byMethod),
      bySource: toRows(bySource),
    };
  },
});

/** 10.2 — daily occupancy + average length of stay. */
export const occupancy = query({
  args: { fromIso: v.string(), toIso: v.string() },
  handler: async (ctx, { fromIso, toIso }) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    rangeMs(fromIso, toIso); // validate
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const bookings = (
      await ctx.db
        .query("bookings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).filter((b) => !["cancelled", "no_show"].includes(b.status));

    const days: { day: string; occupied: number; pct: number }[] = [];
    for (let d = fromIso; d <= toIso; d = addDaysIso(d, 1)) {
      const occupied = bookings.filter(
        (b) => b.checkInDate <= d && b.checkOutDate > d,
      ).length;
      days.push({
        day: d,
        occupied,
        pct: rooms.length ? Math.round((occupied / rooms.length) * 100) : 0,
      });
    }
    const staysInRange = bookings.filter(
      (b) => b.checkInDate >= fromIso && b.checkInDate <= toIso,
    );
    const totalNights = staysInRange.reduce(
      (sum, b) => sum + nightsBetween(b.checkInDate, b.checkOutDate),
      0,
    );
    return {
      rooms: rooms.length,
      days,
      avgPct: days.length
        ? Math.round(days.reduce((s, d) => s + d.pct, 0) / days.length)
        : 0,
      stays: staysInRange.length,
      avgLengthOfStay: staysInRange.length
        ? Math.round((totalNights / staysInRange.length) * 10) / 10
        : 0,
    };
  },
});

/** 10.2 — outstanding balances across non-cancelled bookings. */
export const balances = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const rows = [];
    let totalCents = 0n;
    for (const b of bookings) {
      if (["cancelled", "no_show"].includes(b.status)) continue;
      const balanceCents = await bookingBalanceCents(ctx, b._id);
      if (balanceCents === 0n) continue;
      const guest = await ctx.db.get(b.guestId);
      rows.push({
        reference: b.reference,
        guestName: guest?.fullName ?? "—",
        status: b.status,
        checkOutDate: b.checkOutDate,
        balanceCents,
      });
      if (balanceCents > 0n) totalCents += balanceCents;
    }
    rows.sort((a, b) => (a.balanceCents > b.balanceCents ? -1 : 1));
    return { totalCents, rows };
  },
});

/** 10.3 — simple P&L: confirmed revenue − received purchases. */
export const pnl = query({
  args: { fromIso: v.string(), toIso: v.string() },
  handler: async (ctx, { fromIso, toIso }) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    const { from, to } = rangeMs(fromIso, toIso);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    let revenueCents = 0n;
    for (const p of payments) {
      if (p.status === "confirmed" && p.paidAt && p.paidAt >= from && p.paidAt < to) {
        revenueCents += p.amountCents;
      }
    }
    const pos = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    let purchasesCents = 0n;
    for (const po of pos) {
      if (po.status === "received" && po.receivedAt && po.receivedAt >= from && po.receivedAt < to) {
        purchasesCents += po.totalCents;
      }
    }
    return {
      revenueCents,
      purchasesCents,
      grossCents: revenueCents - purchasesCents,
    };
  },
});

/** 10.3 — inventory: stock value, low stock, top usage, purchases. */
export const inventoryReport = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    const products = await ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    let stockValueCents = 0n;
    const low = [];
    for (const p of products) {
      stockValueCents += p.costCents * BigInt(Math.round(p.stockQty));
      if (p.active && p.stockQty <= p.reorderLevel) {
        low.push({ name: p.name, stockQty: p.stockQty, reorderLevel: p.reorderLevel });
      }
    }
    const movements = await ctx.db
      .query("stockMovements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const usage = new Map<string, number>();
    for (const m of movements) {
      if (m.reason !== "usage") continue;
      const p = products.find((x) => x._id === m.productId);
      if (!p) continue;
      usage.set(p.name, (usage.get(p.name) ?? 0) - m.deltaQty);
    }
    return {
      products: products.length,
      stockValueCents,
      low,
      movements: movements.length,
      topUsage: [...usage.entries()]
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10),
    };
  },
});

/** 10.4 — guest analytics: returning, top spenders, nationality mix. */
export const guestAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    const guests = await ctx.db
      .query("guests")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const bookings = (
      await ctx.db
        .query("bookings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).filter((b) => !["cancelled", "no_show"].includes(b.status));
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const stayCount = new Map<string, number>();
    for (const b of bookings) {
      stayCount.set(b.guestId, (stayCount.get(b.guestId) ?? 0) + 1);
    }
    const spend = new Map<string, bigint>();
    for (const p of payments) {
      if (p.status !== "confirmed" || !p.bookingId) continue;
      const b = bookings.find((x) => x._id === p.bookingId);
      if (!b) continue;
      spend.set(b.guestId, (spend.get(b.guestId) ?? 0n) + p.amountCents);
    }
    const nationality = new Map<string, number>();
    for (const g of guests) {
      const key = g.nationality?.trim() || "Unspecified";
      nationality.set(key, (nationality.get(key) ?? 0) + 1);
    }
    return {
      guests: guests.length,
      returning: [...stayCount.values()].filter((n) => n > 1).length,
      topSpenders: [...spend.entries()]
        .sort((a, b) => (b[1] > a[1] ? 1 : -1))
        .slice(0, 10)
        .map(([guestId, cents]) => ({
          name: guests.find((g) => g._id === guestId)?.fullName ?? "—",
          cents,
        })),
      nationality: [...nationality.entries()].map(([key, count]) => ({ key, count })),
    };
  },
});

/**
 * 10.4 — tax/VAT: ledger charges in range decomposed at the CURRENT active
 * rate (charges are posted VAT-inclusive: vat = gross × bps / (10000 + bps)).
 */
export const taxVat = query({
  args: { fromIso: v.string(), toIso: v.string() },
  handler: async (ctx, { fromIso, toIso }) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    const { from, to } = rangeMs(fromIso, toIso);
    const bps = await activeTaxBps(ctx, orgId);
    const entries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    let grossCents = 0n;
    for (const e of entries) {
      if (e.type !== "charge") continue;
      if (e._creationTime < from || e._creationTime >= to) continue;
      grossCents += e.amountCents;
    }
    const vatCents = bps > 0n ? (grossCents * bps + (10000n + bps) / 2n) / (10000n + bps) : 0n;
    return {
      rateBps: bps,
      grossCents,
      vatCents,
      netCents: grossCents - vatCents,
    };
  },
});

/** 10.4 — assets + damage/missing charges. */
export const assetsReport = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requirePermission(ctx, "Reports", "read");
    const assets = await ctx.db
      .query("roomAssets")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const issues = await ctx.db
      .query("maintenanceIssues")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const damage = issues.filter((i) => i.kind === "damage");
    let chargedCents = 0n;
    for (const d of damage) chargedCents += d.chargeCents ?? 0n;
    return {
      assets: assets.length,
      damageReports: damage.length,
      openDamage: damage.filter((d) => d.status !== "resolved").length,
      chargedCents,
      maintenanceOpen: issues.filter(
        (i) => i.kind === "maintenance" && i.status !== "resolved",
      ).length,
    };
  },
});
