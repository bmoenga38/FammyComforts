import { describe, it, expect } from "vitest";
import { kesToCents, formatKes } from "./money";

describe("kesToCents", () => {
  it("converts whole and decimal KES to integer cents", () => {
    expect(kesToCents("3500")).toBe(350000n);
    expect(kesToCents("3500.50")).toBe(350050n);
    expect(kesToCents("0")).toBe(0n);
  });

  it("rejects negative and non-numeric input", () => {
    expect(() => kesToCents("-5")).toThrow(/valid amount/);
    expect(() => kesToCents("abc")).toThrow(/valid amount/);
  });
});

describe("formatKes", () => {
  it("formats whole amounts without decimals, with thousands separator", () => {
    expect(formatKes(350000n)).toBe("KES 3,500");
    expect(formatKes(0n)).toBe("KES 0");
  });

  it("keeps cents when present, always two digits", () => {
    expect(formatKes(350050n)).toBe("KES 3,500.50");
    expect(formatKes(350005n)).toBe("KES 3,500.05");
    expect(formatKes(5n)).toBe("KES 0.05");
  });

  it("puts the sign before the currency, not inside the number", () => {
    // Refunds and ledger credits are negative. The old implementation divided
    // the signed value, so the remainder was negative too and `padStart` left
    // it alone: "KES -3,500.-50".
    expect(formatKes(-350050n)).toBe("-KES 3,500.50");
    expect(formatKes(-350000n)).toBe("-KES 3,500");
    expect(formatKes(-5n)).toBe("-KES 0.05");
    expect(formatKes(0n)).not.toContain("-");
  });

  it("matches formatKesCents in packages/backend/convex/lib/money.ts", () => {
    // The two are duplicated (see the note on formatKes). These are the exact
    // cases pinned by the backend's own test file — if one side is changed,
    // the diff has to touch both.
    expect(formatKes(100n)).toBe("KES 1");
    expect(formatKes(99n)).toBe("KES 0.99");
    expect(formatKes(9007199254740993n)).toBe("KES 90,071,992,547,409.93");
  });
});
