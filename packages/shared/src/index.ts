/**
 * @sommycomfort/shared — the single source of truth shared by web and api.
 * Story 1.8 expands this with Zod schemas; for now it seeds the app constant
 * and the money utilities the architecture mandates (integer minor units).
 */

export const APP_NAME = "SommyComfort" as const;
export const DEFAULT_CURRENCY = "KES" as const;

/** Convert a major-unit amount (e.g. 3500.00) to integer minor units (cents). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Convert integer minor units back to a major-unit number. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Format integer minor units as a KES display string. */
export function formatKes(cents: number): string {
  return `KES ${fromCents(cents).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
