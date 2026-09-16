/**
 * KES money helpers (Epic 3 web). Money is integer minor units (BigInt cents)
 * end-to-end — these convert at the UI boundary only (NFR14: never floats in
 * stored amounts; display format per the design brief: `KES 3,500`).
 */

/** "3500" or "3500.50" (KES) → integer cents BigInt. Throws on bad input. */
export function kesToCents(kes: string): bigint {
  const n = Number(kes);
  if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid amount.");
  return BigInt(Math.round(n * 100));
}

/**
 * Integer cents BigInt → `"KES 3,500"` (no decimals for whole amounts).
 *
 * Kept byte-identical to `formatKesCents` in `packages/backend/convex/lib/money.ts`,
 * which renders the same amounts inside audit diffs and SMS bodies. It is
 * duplicated rather than imported because the backend package only exports
 * `./convex/_generated/*`; if that ever grows a `./convex/lib/*` entry, delete
 * this and re-export instead.
 */
export function formatKes(cents: bigint): string {
  // Sign is taken off the front before dividing: BigInt division truncates
  // toward zero, so -350050n gives -3500n remainder -50n, and `padStart` on
  // "-50" is a no-op — the naive version rendered "KES -3,500.-50".
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const shillings = abs / 100n;
  const rem = abs % 100n;
  const whole = shillings.toLocaleString("en-KE");
  const body = rem === 0n ? whole : `${whole}.${rem.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}KES ${body}`;
}
