import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Front-desk gating (Epic 6): page requires Bookings:read; write-only tabs
 * (New booking) and payment affordances follow the caller's grants.
 */
let perms: string[] | undefined;

vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: {
    roles: { myPermissions: "roles.myPermissions" },
    deskBookings: {
      board: "deskBookings.board",
      confirm: "c",
      checkIn: "ci",
      checkOut: "co",
      extend: "e",
      cancel: "x",
      markNoShow: "ns",
      refund: "rf",
      create: "cr",
    },
    payments: { recordManual: "rm" },
    invoices: { generate: "ig" },
    calendar: { grid: "calendar.grid" },
    guests: { list: "guests.list", create: "gc" },
    rooms: { list: "rooms.list" },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: string) => {
    if (ref === "roles.myPermissions") return perms;
    if (ref === "deskBookings.board")
      return { arrivals: [], departures: [], inHouse: [], pending: [] };
    return [];
  },
  useMutation: () => vi.fn(),
}));

import FrontDeskPage from "./page";

beforeEach(() => {
  perms = [];
});

describe("FrontDeskPage gating", () => {
  it("shows 'No access' without Bookings:read", () => {
    perms = ["Housekeeping:read"];
    render(<FrontDeskPage />);
    expect(screen.getByText(/no access/i)).toBeInTheDocument();
  });

  it("read-only staff see the board but no New-booking tab", () => {
    perms = ["Bookings:read"];
    render(<FrontDeskPage />);
    expect(screen.getByRole("tab", { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /calendar/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /new booking/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /guests/i })).toBeNull();
  });

  it("a receptionist grant set shows all four tabs", () => {
    perms = ["Bookings:read", "Bookings:write", "Guests:read", "Guests:write", "Payments:write"];
    render(<FrontDeskPage />);
    for (const label of [/today/i, /calendar/i, /new booking/i, /guests/i]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });
});
