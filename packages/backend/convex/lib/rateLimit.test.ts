// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  phoneKey,
  checkBookingRate,
  retryMinutes,
  DEFAULT_BOOKING_LIMITS,
  type BookingAttempt,
  type RateLimits,
} from "./rateLimit";

const MIN = 60_000;
const NOW = 1_800_000_000_000; // fixed clock — the function never reads one itself

/** One website booking `agoMs` before NOW, from `key`. */
function attempt(agoMs: number, key: string | null, source = "website"): BookingAttempt {
  return { creationTime: NOW - agoMs, source, phoneKey: key };
}

const ADA = "712345678";
const BEN = "722999888";

describe("phoneKey", () => {
  it("collapses every Kenyan format of one number to the same key", () => {
    // Without this, re-typing the number differently would reset the limit —
    // which is the first thing anyone hitting a limit tries.
    expect(phoneKey("+254712345678")).toBe(ADA);
    expect(phoneKey("254712345678")).toBe(ADA);
    expect(phoneKey("0712345678")).toBe(ADA);
    expect(phoneKey("0712 345 678")).toBe(ADA);
    expect(phoneKey("(+254) 712-345-678")).toBe(ADA);
  });

  it("keys on the last nine digits only", () => {
    expect(phoneKey("00000000712345678")).toBe(ADA);
    expect(phoneKey("712345678")).toBe(ADA);
  });

  it("returns null when there are fewer than nine digits", () => {
    // A short key would collide across guests, so no key is safer than a bad
    // one. The mutation has already rejected these anyway.
    expect(phoneKey("12345678")).toBe(null);
    expect(phoneKey("")).toBe(null);
    expect(phoneKey("no digits here")).toBe(null);
  });
});

describe("retryMinutes", () => {
  it("rounds up, and never tells a guest to wait zero minutes", () => {
    expect(retryMinutes(0)).toBe(1);
    expect(retryMinutes(1)).toBe(1);
    expect(retryMinutes(MIN)).toBe(1);
    expect(retryMinutes(MIN + 1)).toBe(2);
    expect(retryMinutes(9.5 * MIN)).toBe(10);
  });
});

describe("checkBookingRate — per phone", () => {
  it("allows a first booking, and a family booking three rooms in a row", () => {
    expect(checkBookingRate([], NOW, ADA)).toEqual({ ok: true });
    expect(checkBookingRate([attempt(1 * MIN, ADA)], NOW, ADA)).toEqual({ ok: true });
    expect(
      checkBookingRate([attempt(1 * MIN, ADA), attempt(2 * MIN, ADA)], NOW, ADA),
    ).toEqual({ ok: true });
  });

  it("refuses the fourth booking from one number within the hour", () => {
    const verdict = checkBookingRate(
      [attempt(50 * MIN, ADA), attempt(20 * MIN, ADA), attempt(1 * MIN, ADA)],
      NOW,
      ADA,
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("phone");
    // Wait until the OLDEST of the three leaves the hour: 60 - 50 = 10 minutes.
    expect(verdict.retryAfterMs).toBe(10 * MIN);
    expect(retryMinutes(verdict.retryAfterMs)).toBe(10);
  });

  it("ignores bookings that have aged out of the window", () => {
    expect(
      checkBookingRate(
        [attempt(61 * MIN, ADA), attempt(90 * MIN, ADA), attempt(5 * MIN, ADA)],
        NOW,
        ADA,
      ),
    ).toEqual({ ok: true });
  });

  it("treats the window edge as expired", () => {
    // The comparison is `> cutoff`, so a booking exactly one window old has
    // left. Pinned because flipping it to `>=` would hold guests an extra tick.
    const edge = [attempt(60 * MIN, ADA), attempt(60 * MIN, ADA), attempt(60 * MIN, ADA)];
    expect(checkBookingRate(edge, NOW, ADA)).toEqual({ ok: true });
  });

  it("counts each number separately", () => {
    const three = [attempt(1 * MIN, BEN), attempt(2 * MIN, BEN), attempt(3 * MIN, BEN)];
    expect(checkBookingRate(three, NOW, ADA)).toEqual({ ok: true });
    expect(checkBookingRate(three, NOW, BEN).ok).toBe(false);
  });

  it("does not count desk-entered bookings against the guest's own number", () => {
    // A receptionist booking the same guest three times must not lock that
    // guest out of the website.
    const desk = [
      attempt(1 * MIN, ADA, "walk_in"),
      attempt(2 * MIN, ADA, "phone"),
      attempt(3 * MIN, ADA, "agent"),
    ];
    expect(checkBookingRate(desk, NOW, ADA)).toEqual({ ok: true });
  });

  it("skips the phone check when the number could not be keyed", () => {
    const three = [attempt(1 * MIN, null), attempt(2 * MIN, null), attempt(3 * MIN, null)];
    expect(checkBookingRate(three, NOW, null)).toEqual({ ok: true });
  });
});

describe("checkBookingRate — org-wide circuit breaker", () => {
  /** `n` website bookings from distinct numbers, spread over the last `spanMin`. */
  function flood(n: number, spanMin: number): BookingAttempt[] {
    return Array.from({ length: n }, (_, i) =>
      attempt(Math.round(((i + 1) / n) * spanMin * MIN), `7${String(i).padStart(8, "0")}`),
    );
  }

  it("catches a flood that rotates phone numbers", () => {
    // Rotating the number defeats the per-phone cap entirely, which is the
    // whole reason this second check exists.
    const verdict = checkBookingRate(flood(DEFAULT_BOOKING_LIMITS.orgMax, 9), NOW, ADA);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("org");
    expect(verdict.retryAfterMs > 0).toBe(true);
    expect(verdict.retryAfterMs <= DEFAULT_BOOKING_LIMITS.orgWindowMs).toBe(true);
  });

  it("stays out of the way one booking below the cap", () => {
    expect(checkBookingRate(flood(DEFAULT_BOOKING_LIMITS.orgMax - 1, 9), NOW, ADA)).toEqual({
      ok: true,
    });
  });

  it("does not count staff bookings — a busy front desk is not an attack", () => {
    const desk = Array.from({ length: 40 }, (_, i) =>
      attempt(i * 10_000, `7${String(i).padStart(8, "0")}`, "walk_in"),
    );
    expect(checkBookingRate(desk, NOW, ADA)).toEqual({ ok: true });
  });

  it("fails open on a truncated read", () => {
    // The caller reads only the newest N bookings. Truncation can only remove
    // attempts, so the worst case is letting a booking through — never turning
    // a real guest away because of rows nobody looked at.
    const full = flood(DEFAULT_BOOKING_LIMITS.orgMax, 9);
    expect(checkBookingRate(full, NOW, ADA).ok).toBe(false);
    expect(checkBookingRate(full.slice(0, 5), NOW, ADA)).toEqual({ ok: true });
  });

  it("reports the phone reason first when both caps are exceeded", () => {
    // "You've booked three times this hour" is actionable; the org-wide message
    // is not. Order matters, so it is pinned.
    const both = [...flood(DEFAULT_BOOKING_LIMITS.orgMax, 9), attempt(1, ADA), attempt(2, ADA), attempt(3, ADA)];
    const verdict = checkBookingRate(both, NOW, ADA);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toBe("phone");
  });
});

describe("checkBookingRate — configuration", () => {
  it("treats a non-positive max as a kill switch for that check", () => {
    // Lets an operator disable one half without redeploying logic.
    const off: RateLimits = { ...DEFAULT_BOOKING_LIMITS, phoneMax: 0, orgMax: 0 };
    const busy = [attempt(1, ADA), attempt(2, ADA), attempt(3, ADA), attempt(4, ADA)];
    expect(checkBookingRate(busy, NOW, ADA, off)).toEqual({ ok: true });
  });

  it("honours tightened limits", () => {
    const strict: RateLimits = { phoneWindowMs: 5 * MIN, phoneMax: 1, orgWindowMs: MIN, orgMax: 5 };
    expect(checkBookingRate([attempt(1 * MIN, ADA)], NOW, ADA, strict)).toEqual({
      ok: false,
      reason: "phone",
      retryAfterMs: 4 * MIN,
    });
    expect(checkBookingRate([attempt(6 * MIN, ADA)], NOW, ADA, strict)).toEqual({ ok: true });
  });

  it("keeps the shipped defaults where they were reviewed", () => {
    // Changing these changes how much a booking flood can cost the property, so
    // the numbers are asserted rather than left to a silent edit.
    expect(DEFAULT_BOOKING_LIMITS).toEqual({
      phoneWindowMs: 60 * MIN,
      phoneMax: 3,
      orgWindowMs: 10 * MIN,
      orgMax: 20,
    });
  });
});
