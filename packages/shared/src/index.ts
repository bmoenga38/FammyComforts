/**
 * @sommycomfort/shared — the single source of truth shared by web and api.
 * Money utilities (integer minor units) + the Zod web↔api contract (AR5).
 */

export * from "./contracts";

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
