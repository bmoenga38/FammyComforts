/**
 * Rate-limit decision for the PUBLIC booking form (§11.7 Q7).
 *
 * `guestBookings.create` is unauthenticated, and every success queues an SMS
 * that costs real money under the property's HostPinnacle account — a loop
 * against it is a billing attack, not just spam. Convex mutations don't expose
 * the caller's IP (only HTTP actions see headers), so the only durable signals
 * available are the phone number the form supplies and the org's own recent
 * booking history. That is what this decides on.
 *
 * Deliberately not IP-based and not a proof-of-work challenge: both need an
 * HTTP action or Turnstile in front of the mutation. Until then this caps the
 * damage — a determined attacker rotating phone numbers still hits the org-wide
 * circuit breaker.
 *
 * PURE — no `ctx`, no clock — per the `lib/` convention. The caller reads the
 * recent bookings and passes `now`, so every branch below is unit-testable.
 */

/**
 * Comparable form of a phone number: the last 9 digits.
 *
 * Kenyan mobile numbers are 9 significant digits after the country/trunk
 * prefix, so `+254712345678`, `254712345678`, `0712345678` and
 * `0712 345 678` all collapse to `712345678`. Without this, re-typing the same
 * number a different way would reset the limit.
 *
 * Returns `null` when there aren't 9 digits to key on — the caller has already
 * rejected such input, and a short key would collide across guests.
 */
export function phoneKey(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/** One prior booking, reduced to just what the decision needs. */
export type BookingAttempt = {
  /** `_creationTime` — ms epoch. */
  creationTime: number;
  /** `source` — only `"website"` bookings came through the public form. */
  source: string;
  /** `phoneKey()` of the guest on that booking, or `null` if unresolvable. */
  phoneKey: string | null;
};

export type RateLimits = {
  /** Per-phone window, ms. */
  phoneWindowMs: number;
  /** Bookings allowed from one phone inside that window. `<= 0` disables the check. */
  phoneMax: number;
  /** Org-wide window, ms. */
  orgWindowMs: number;
  /** Website bookings allowed org-wide inside that window. `<= 0` disables the check. */
  orgMax: number;
};

/**
 * Defaults chosen to be invisible to real guests and painful to a script.
 *
 * A family booking three rooms one after another is normal, so the per-phone cap
 * is 3/hour rather than 1. The org cap is a circuit breaker, not a business
 * rule: 20 website bookings in 10 minutes is far above any real arrival rate for
 * a property this size, so tripping it means something is wrong. Erring loose is
 * deliberate — refusing a paying guest costs more than one wasted SMS.
 */
export const DEFAULT_BOOKING_LIMITS: RateLimits = {
  phoneWindowMs: 60 * 60_000, // 1 hour
  phoneMax: 3,
  orgWindowMs: 10 * 60_000, // 10 minutes
  orgMax: 20,
};

export type RateLimitVerdict =
  | { ok: true }
  | { ok: false; reason: "phone" | "org"; retryAfterMs: number };

/** Whole minutes to wait, rounded up, never below 1 — for the user-facing message. */
export function retryMinutes(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 60_000));
}

/**
 * Decide whether one more public booking is allowed.
 *
 * `attempts` is the org's recent bookings, any order, and MAY be truncated by
 * the caller's `.take()` — truncation can only make the counts smaller, so a
 * truncated read fails open rather than blocking a real guest.
 *
 * The phone check is evaluated first: it is the specific, explainable one, and
 * telling a guest "you've booked three times this hour" is more useful than the
 * generic org-wide message.
 */
export function checkBookingRate(
  attempts: readonly BookingAttempt[],
  now: number,
  key: string | null,
  limits: RateLimits = DEFAULT_BOOKING_LIMITS,
): RateLimitVerdict {
  if (key !== null && limits.phoneMax > 0) {
    const cutoff = now - limits.phoneWindowMs;
    const mine = attempts
      // `source` is checked here too, so the verdict is correct even if a caller
      // resolves phone keys for desk-entered bookings: a receptionist booking
      // the same guest three times must not lock the guest out of the website.
      .filter((a) => a.source === "website" && a.phoneKey === key && a.creationTime > cutoff)
      .map((a) => a.creationTime)
      .sort((x, y) => x - y);
    if (mine.length >= limits.phoneMax) {
      // Wait until the oldest one leaves the window; `mine` is sorted and
      // non-empty here because phoneMax > 0.
      const oldest = mine[0] as number;
      return {
        ok: false,
        reason: "phone",
        retryAfterMs: Math.max(0, oldest + limits.phoneWindowMs - now),
      };
    }
  }

  if (limits.orgMax > 0) {
    const cutoff = now - limits.orgWindowMs;
    const recent = attempts
      .filter((a) => a.source === "website" && a.creationTime > cutoff)
      .map((a) => a.creationTime)
      .sort((x, y) => x - y);
    if (recent.length >= limits.orgMax) {
      const oldest = recent[0] as number;
      return {
        ok: false,
        reason: "org",
        retryAfterMs: Math.max(0, oldest + limits.orgWindowMs - now),
      };
    }
  }

  return { ok: true };
}
