import { describe, it, expect } from "vitest";
import { hasPermission, PERMISSION_AREAS, ACTIONS } from "./permissions";

describe("hasPermission", () => {
  it("matches an exact area:action grant", () => {
    const perms = ["Roles:manage", "Bookings:write"];
    expect(hasPermission(perms, "Roles", "manage")).toBe(true);
    expect(hasPermission(perms, "Bookings", "write")).toBe(true);
  });

  it("is false for an absent grant (no implication)", () => {
    expect(hasPermission(["Bookings:manage"], "Bookings", "read")).toBe(false);
    expect(hasPermission([], "Dashboard", "read")).toBe(false);
  });

  it("exposes the full catalog (18 areas × 3 actions)", () => {
    expect(PERMISSION_AREAS).toHaveLength(18);
    expect(ACTIONS).toEqual(["read", "write", "manage"]);
  });
});
