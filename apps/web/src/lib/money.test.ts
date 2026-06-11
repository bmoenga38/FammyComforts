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
  });

  it("keeps cents when present", () => {
    expect(formatKes(350050n)).toBe("KES 3,500.50");
    expect(formatKes(5n)).toBe("KES 0.05");
  });
});
