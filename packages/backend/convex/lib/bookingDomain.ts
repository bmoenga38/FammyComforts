import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Shared guest-booking domain logic (Epic 4) — used by both the public catalog
 * queries and the booking-create mutation so availability and pricing can never
 * disagree between "what the guest saw" and "what got booked".
 *
 * Dates are ISO "YYYY-MM-DD" strings compared lexicographically (valid for this
 * format). Stays are HALF-OPEN intervals [checkIn, checkOut): the checkout day
 * frees the room, so back-to-back bookings (A out / B in same day) don't clash.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateRange(checkIn: string, checkOut: string): void {
  for (const [label, d] of [
    ["checkInDate", checkIn],
    ["checkOutDate", checkOut],
  ] as const) {
    if (!DATE_RE.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`))) {
      throw new Error(`${label} must be a valid "YYYY-MM-DD" date.`);
    }
  }
  if (checkIn >= checkOut) {
    throw new Error("checkOutDate must be after checkInDate.");
  }
  if (nightsBetween(checkIn, checkOut) > 90) {
    throw new Error("Stays longer than 90 nights are not bookable online.");
  }
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms =
    Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** ISO date arithmetic in UTC (safe for "YYYY-MM-DD" strings). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Booking statuses that hold the room (block availability). */
const BLOCKING = new Set(["pending", "confirmed", "checked_in"]);

/** True if the room has a blocking booking overlapping [checkIn, checkOut). */
export async function hasConflict(
  ctx: QueryCtx,
  roomId: Id<"rooms">,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const existing = await ctx.db
    .query("bookings")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return existing.some(
    (b) =>
      BLOCKING.has(b.status) &&
      b.checkInDate < checkOut && // existing starts before new ends
      b.checkOutDate > checkIn, // existing ends after new starts
  );
}

/** Resolve a tenant from its public slug (guest routes carry no session). */
export async function orgBySlug(
  ctx: QueryCtx,
  slug: string,
): Promise<Doc<"organizations">> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!org) throw new Error("Unknown property.");
  return org;
}

/**
 * The lowest-priced ACTIVE rate plan for a room type, or null if unpriced
 * (unpriced rooms are shown but not bookable online).
 */
export async function activeRatePlan(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  roomTypeId: Id<"roomTypes">,
): Promise<Doc<"ratePlans"> | null> {
  const plans = (
    await ctx.db
      .query("ratePlans")
      .withIndex("by_roomType", (q) => q.eq("roomTypeId", roomTypeId))
      .collect()
  ).filter((p) => p.orgId === orgId && p.active);
  if (plans.length === 0) return null;
  return plans.reduce((min, p) => (p.nightlyCents < min.nightlyCents ? p : min));
}

/**
 * Sum of ACTIVE tax-rule rates as basis points (0.16 → 1600). Integer math so
 * tax never floats (NFR14).
 */
export async function activeTaxBps(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<bigint> {
  const rules = await ctx.db
    .query("taxRules")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  let bps = 0;
  for (const r of rules) if (r.active) bps += Math.round(r.rate * 10000);
  return BigInt(bps);
}

/** Multi-night totals in integer cents: subtotal, tax (round half up), total. */
export function priceStay(
  nightlyCents: bigint,
  nights: number,
  taxBps: bigint,
): { subtotalCents: bigint; taxCents: bigint; totalCents: bigint } {
  const subtotalCents = nightlyCents * BigInt(nights);
  const taxCents = (subtotalCents * taxBps + 5000n) / 10000n;
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
