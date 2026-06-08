import { describe, it, expect } from "vitest";
import {
  idSchema,
  paginationQuerySchema,
  isoUtcSchema,
  toIsoUtc,
  healthResponseSchema,
  ok,
  fail,
} from "./contracts";

describe("idSchema", () => {
  it("accepts a UUID and rejects junk", () => {
    expect(idSchema.safeParse("0190f1b2-1c3d-7e4f-8a9b-0c1d2e3f4a5b").success).toBe(true);
    expect(idSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("paginationQuerySchema", () => {
  it("defaults page/pageSize and coerces strings", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("rejects out-of-range pageSize", () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });
});

describe("dates (ISO-8601 UTC)", () => {
  it("toIsoUtc produces a string the schema accepts", () => {
    const iso = toIsoUtc(new Date(0));
    expect(iso).toBe("1970-01-01T00:00:00.000Z");
    expect(isoUtcSchema.safeParse(iso).success).toBe(true);
  });
  it("rejects a non-ISO date string", () => {
    expect(isoUtcSchema.safeParse("2026-06-08").success).toBe(false);
  });
});

describe("response envelope", () => {
  it("ok wraps data, optionally with meta", () => {
    expect(ok({ a: 1 })).toEqual({ data: { a: 1 } });
    expect(ok([1, 2], { page: 1, pageSize: 20, total: 2 })).toEqual({
      data: [1, 2],
      meta: { page: 1, pageSize: 20, total: 2 },
    });
  });

  it("fail builds a coded error, omitting details when absent", () => {
    expect(fail("NOT_FOUND", "missing")).toEqual({
      error: { code: "NOT_FOUND", message: "missing" },
    });
    expect(fail("BAD", "x", [{ field: "y" }])).toEqual({
      error: { code: "BAD", message: "x", details: [{ field: "y" }] },
    });
  });
});

describe("healthResponseSchema", () => {
  it("accepts ok/up and ok/down, rejects other status", () => {
    expect(healthResponseSchema.safeParse({ status: "ok", db: "up" }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ status: "ok", db: "down" }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ status: "bad", db: "up" }).success).toBe(false);
  });
});
