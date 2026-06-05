import { describe, it, expect } from "vitest";
import { APP_NAME, DEFAULT_CURRENCY, toCents, fromCents, formatKes } from "./index";

describe("constants", () => {
  it("exposes the app name and default currency", () => {
    expect(APP_NAME).toBe("SommyComfort");
    expect(DEFAULT_CURRENCY).toBe("KES");
  });
});

describe("money utils", () => {
  it("toCents converts major units to integer minor units", () => {
    expect(toCents(3500)).toBe(350000);
    expect(toCents(0)).toBe(0);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(99.99)).toBe(9999);
  });

  it("toCents always returns an integer", () => {
    expect(Number.isInteger(toCents(1234.56))).toBe(true);
    expect(Number.isInteger(toCents(0.005))).toBe(true);
  });

  it("fromCents is the inverse of toCents", () => {
    expect(fromCents(350000)).toBe(3500);
    expect(fromCents(9999)).toBe(99.99);
    expect(fromCents(toCents(1234.56))).toBe(1234.56);
  });

  it("formatKes renders integer minor units as a KES string with 2 decimals", () => {
    expect(formatKes(0)).toBe("KES 0.00");
    expect(formatKes(150)).toBe("KES 1.50");
    expect(formatKes(350000)).toContain("3,500.00");
    expect(formatKes(350000).startsWith("KES ")).toBe(true);
  });
});
