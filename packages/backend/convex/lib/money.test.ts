// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatKesCents } from "./money";

/**
 * `formatKesCents` is the server-side twin of the web's `formatKes`. It exists
 * because audit diffs, user-facing error messages and SMS bodies are all built on
 * the backend, and a shilling amount has to read the same wherever it was
 * rendered. These tests pin the shared format and the one behaviour that differs.
 */
describe("formatKesCents", () => {
  it("formats whole shillings with a thousands separator and no decimals", () => {
    expect(formatKesCents(350000n)).toBe("KES 3,500");
    expect(formatKesCents(0n)).toBe("KES 0");
    expect(formatKesCents(100n)).toBe("KES 1");
  });

  it("keeps cents only when there are cents, always two digits", () => {
    expect(formatKesCents(350050n)).toBe("KES 3,500.50");
    // 05, not 5 — a bare `rem.toString()` would render "KES 3,500.5", which
    // reads as fifty cents.
    expect(formatKesCents(350005n)).toBe("KES 3,500.05");
    expect(formatKesCents(99n)).toBe("KES 0.99");
    expect(formatKesCents(5n)).toBe("KES 0.05");
  });

  it("renders large amounts exactly, where Number(cents) / 100 cannot", () => {
    // 9007199254740993 is the first odd integer above Number.MAX_SAFE_INTEGER.
    // As a double it collapses to ...992, so the naive `Number(cents) / 100`
    // this function replaced would say .92 here. BigInt division says .93.
    const cents = 9007199254740993n;
    expect(Number(cents) / 100).not.toBe(90071992547409.93);
    expect(formatKesCents(cents)).toBe("KES 90,071,992,547,409.93");
  });

  it("puts the sign before the currency, not inside the number", () => {
    // Reached by ledger credits and refunds surfacing in an audit diff. The
    // sign is handled by taking the absolute value first: BigInt division
    // truncates toward zero, so -350050n / 100n is -3500n with a remainder of
    // -50n, and padStart on "-50" would produce "KES -3,500.-50".
    expect(formatKesCents(-350050n)).toBe("-KES 3,500.50");
    expect(formatKesCents(-350000n)).toBe("-KES 3,500");
    expect(formatKesCents(-5n)).toBe("-KES 0.05");
  });

  it("never emits a bare minus for zero", () => {
    // -0n does not exist in BigInt, so this can only come from 0n. Guards
    // against a future refactor that formats the sign from a boolean flag.
    expect(formatKesCents(0n)).not.toContain("-");
  });
});
