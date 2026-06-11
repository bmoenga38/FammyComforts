import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Property-setup gating (Epic 3 web): all tabs render (operational reads are
 * open to org members), but edit affordances only appear with the matching
 * `:manage` permission. Server enforces authoritatively.
 */
let perms: string[] | undefined;

vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: {
    roles: { myPermissions: "roles.myPermissions" },
    property: { list: "property.list", create: "property.create", update: "property.update" },
    branches: {
      list: "branches.list",
      create: "branches.create",
      remove: "branches.remove",
    },
    roomTypes: {
      list: "roomTypes.list",
      create: "roomTypes.create",
      remove: "roomTypes.remove",
    },
    amenities: {
      list: "amenities.list",
      create: "amenities.create",
      remove: "amenities.remove",
    },
    rooms: {
      list: "rooms.list",
      create: "rooms.create",
      setStatus: "rooms.setStatus",
      remove: "rooms.remove",
    },
    rates: {
      listRatePlans: "rates.listRatePlans",
      listTaxRules: "rates.listTaxRules",
      createRatePlan: "rates.createRatePlan",
      updateRatePlan: "rates.updateRatePlan",
      createTaxRule: "rates.createTaxRule",
    },
    notifications: { list: "notifications.list", setEnabled: "notifications.setEnabled" },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: string) => (ref === "roles.myPermissions" ? perms : []),
  useMutation: () => vi.fn(),
}));

import SetupAdminPage from "./page";

beforeEach(() => {
  perms = [];
});

describe("SetupAdminPage gating", () => {
  it("renders all tabs for any org member (open operational reads)", () => {
    perms = []; // signed-in member, no manage grants
    render(<SetupAdminPage />);
    for (const label of [
      /property & branches/i,
      /room types/i,
      /^rooms$/i,
      /rates & tax/i,
      /notifications/i,
    ]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("hides the create-property form without Settings:manage", () => {
    perms = [];
    render(<SetupAdminPage />);
    expect(screen.queryByRole("button", { name: /create property/i })).toBeNull();
    expect(screen.getByText(/an admin sets this up/i)).toBeInTheDocument();
  });

  it("shows the create-property form with Settings:manage", () => {
    perms = ["Settings:manage"];
    render(<SetupAdminPage />);
    expect(
      screen.getByRole("button", { name: /create property/i }),
    ).toBeInTheDocument();
  });

  it("renders a loading state until permissions resolve", () => {
    perms = undefined;
    render(<SetupAdminPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
