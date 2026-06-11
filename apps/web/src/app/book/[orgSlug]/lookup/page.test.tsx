import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/** Guest lookup (4.8): submits reference+contact, renders the safe result view. */
let lookupResult: unknown = undefined;
let lastArgs: unknown = null;

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "acme" }),
}));
vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: { guestBookings: { lookup: "guestBookings.lookup" } },
}));
vi.mock("convex/react", () => ({
  useQuery: (_ref: string, args: unknown) => {
    if (args === "skip") return undefined;
    lastArgs = args;
    return lookupResult;
  },
}));

import LookupPage from "./page";

beforeEach(() => {
  lookupResult = undefined;
  lastArgs = null;
});

describe("guest lookup page", () => {
  it("requires both reference and contact before querying", () => {
    render(<LookupPage />);
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));
    expect(lastArgs).toBeNull(); // skip — nothing submitted
  });

  it("shows the booking summary on a match", () => {
    lookupResult = {
      reference: "BK-ABC234",
      status: "pending",
      checkInDate: "2099-03-01",
      checkOutDate: "2099-03-04",
      roomNumber: "101",
      roomType: "Deluxe",
      propertyName: "Org acme",
      guestName: "Ada Guest",
      expectedTotalCents: 1218000n,
      balanceCents: 1218000n,
      currency: "KES",
      paymentMethod: "mpesa_stk",
    };
    render(<LookupPage />);
    fireEvent.change(screen.getByLabelText(/booking reference/i), {
      target: { value: "BK-ABC234" },
    });
    fireEvent.change(screen.getByLabelText(/phone or email/i), {
      target: { value: "+254700000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(screen.getByText("BK-ABC234")).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    // Total and balance are equal until Epic 5 records payments — two matches.
    expect(screen.getAllByText(/KES 12,180/)).toHaveLength(2);
    expect(lastArgs).toEqual({ reference: "BK-ABC234", contact: "+254700000001" });
  });

  it("shows a generic no-match message (no enumeration hint)", () => {
    lookupResult = null;
    render(<LookupPage />);
    fireEvent.change(screen.getByLabelText(/booking reference/i), {
      target: { value: "BK-WRONG1" },
    });
    fireEvent.change(screen.getByLabelText(/phone or email/i), {
      target: { value: "nobody@x.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));
    expect(screen.getByText(/no booking matches/i)).toBeInTheDocument();
  });
});
