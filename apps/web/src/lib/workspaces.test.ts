import { describe, it, expect } from "vitest";
import {
  WORKSPACES,
  WORKSPACE_BY_SLUG,
  DEFAULT_WORKSPACE,
  isWorkspaceActive,
  workspaceForPathname,
} from "./workspaces";

describe("workspaces", () => {
  it("defines the staff role workspaces in order (no customer entry)", () => {
    expect(WORKSPACES.map((w) => w.slug)).toEqual([
      "admin",
      "front-desk",
      "operations",
      "housekeeping",
      "kitchen",
    ]);
  });

  it("defaults to the admin workspace", () => {
    expect(DEFAULT_WORKSPACE.slug).toBe("admin");
    expect(DEFAULT_WORKSPACE.href).toBe("/admin");
  });

  it("matches the active workspace by pathname (exact and nested, not prefix-bleed)", () => {
    const frontDesk = WORKSPACE_BY_SLUG["front-desk"];
    expect(isWorkspaceActive(frontDesk, "/front-desk")).toBe(true);
    expect(isWorkspaceActive(frontDesk, "/front-desk/calendar")).toBe(true);
    expect(isWorkspaceActive(frontDesk, "/front-desktop")).toBe(false);
    expect(isWorkspaceActive(frontDesk, "/guest")).toBe(false);
  });

  it("resolves the workspace for a pathname (or undefined)", () => {
    expect(workspaceForPathname("/kitchen")?.title).toBe("Kitchen Display");
    expect(workspaceForPathname("/unknown")).toBeUndefined();
  });

  it("exposes the primary staff workspaces in the bottom nav (operations excluded)", () => {
    expect(WORKSPACES.filter((w) => w.inBottomNav).map((w) => w.slug)).toEqual([
      "admin",
      "front-desk",
      "housekeeping",
      "kitchen",
    ]);
  });
});
