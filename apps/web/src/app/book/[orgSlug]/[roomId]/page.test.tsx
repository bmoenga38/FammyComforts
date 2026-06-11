import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Booking form (4.4): consent is required — the submit button stays disabled
 * until the consent box is checked (and dates are present via the URL).
 */
vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "acme", roomId: "room_1" }),
  useSearchParams: () => new URLSearchParams("in=2099-03-01&out=2099-03-04"),
}));
vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: {
    catalog: { roomDetail: "catalog.roomDetail" },
    guestBookings: {
      create: "guestBookings.create",
      generateUploadUrl: "guestBookings.generateUploadUrl",
    },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({
    propertyName: "Org acme",
    number: "101",
    floor: null,
    status: "available",
    branchName: "Main",
    location: "CBD",
    typeName: "Deluxe",
    capacity: 2,
    sizeSqm: 24,
    amenities: ["Wi-Fi"],
    nightlyCents: 350000n,
    currency: "KES",
    checkInTime: "14:00",
    checkOutTime: "10:00",
    cancellationNote: null,
    idRequired: true,
    available: true,
    nights: 3,
    totals: { subtotalCents: 1050000n, taxCents: 168000n, totalCents: 1218000n },
  }),
  useMutation: () => vi.fn(),
}));

import RoomBookingPage from "./page";

describe("room booking page", () => {
  it("renders detail (amenities, policy, exact totals) and disables submit until consent", () => {
    render(<RoomBookingPage />);
    expect(screen.getByText(/Deluxe · Room 101/)).toBeInTheDocument();
    expect(screen.getByText(/Wi-Fi/)).toBeInTheDocument();
    expect(screen.getByText(/ID required at check-in/)).toBeInTheDocument();
    expect(screen.getByText(/3 nights = KES 12,180 incl\. tax/)).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /confirm booking/i });
    expect(submit).toBeDisabled(); // consent unchecked

    const consent = screen.getByRole("checkbox", { name: /i consent/i });
    consent.click();
  });
});
