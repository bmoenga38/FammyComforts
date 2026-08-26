/**
 * KES money formatting for backend-generated text (user-facing error messages,
 * SMS bodies, audit-log diffs).
 *
 * Money is `v.int64()` integer minor units end-to-end (NFR14) — never a float in
 * anything stored. These helpers convert at the *text* boundary only.
 *
 * Deliberately mirrors `apps/web/src/lib/money.ts` (`formatKes`) so a shilling
 * amount reads identically whether the string was built on the server or in the
 * browser. The arithmetic here is exact BigInt division rather than
 * `Number(cents) / 100`, so it cannot drift on large amounts.
 */

/** Integer cents → `"KES 3,500"` (`"KES 3,500.50"` when there are odd cents). */
export function formatKesCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const shillings = abs / 100n;
  const rem = abs % 100n;
  const whole = shillings.toLocaleString("en-KE");
  const body = rem === 0n ? whole : `${whole}.${rem.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}KES ${body}`;
}
