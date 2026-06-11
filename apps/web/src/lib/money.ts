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

/** Integer cents BigInt → "KES 3,500" (no decimals for whole amounts). */
export function formatKes(cents: bigint): string {
  const shillings = cents / 100n;
  const rem = cents % 100n;
  const whole = shillings.toLocaleString("en-KE");
  return rem === 0n
    ? `KES ${whole}`
    : `KES ${whole}.${rem.toString().padStart(2, "0")}`;
}
