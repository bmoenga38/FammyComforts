/**
 * Demo-auth phone normalization: numbers match on their LAST 9 DIGITS, so
 * "0792697197", "+254 792 697 197", and "254792697197" are the same user.
 * Returns "" when fewer than 9 digits are present (never matches).
 */
export function normPhone(p: string): string {
  const digits = String(p ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}
