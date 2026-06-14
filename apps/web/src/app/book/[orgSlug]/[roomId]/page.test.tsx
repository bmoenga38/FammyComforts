import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * 3-step booking flow (4.2/4.4): step 1 shows detail facts + exact totals and
 * validates guest fields before advancing; step 2 (Pay) gates the confirm
 * button behind consent — matching the prototype's Details → Pay → Confirmed
 * stepper.
 */
vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "acme", roomId: "room_1" }),
  useSearchParams: () => new URLSearchParams("in=2099-03-01&out=2099-03-04"),
}));
vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: {
    catalog: { roomDetail: "catalog.roomDetail" },
    paymentMethods: { enabledMethods: "paymentMethods.enabledMethods" },
    guestBookings: {
      create: "guestBookings.create",
      generateUploadUrl: "guestBookings.generateUploadUrl",
    },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: string) =>
    ref === "paymentMethods.enabledMethods"
      ? ["mpesa_stk", "cash", "card"]
      : {
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
        },
  useMutation: () => vi.fn(),
}));

import RoomBookingPage from "./page";

describe("room booking stepper", () => {
  it("step 1 renders detail, amenities, policy, and exact totals", () => {
    render(<RoomBookingPage />);
    expect(screen.getByText(/Deluxe · Room 101/)).toBeInTheDocument();
    expect(screen.getByText(/Wi-Fi/)).toBeInTheDocument();
    expect(screen.getByText(/ID required at check-in/)).toBeInTheDocument();
    expect(screen.getByText(/KES 12,180/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to payment/i })).toBeInTheDocument();
  });

  it("validates guest fields before advancing to Pay", () => {
    render(<RoomBookingPage />);
    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));
    // Validation error shown and we're still on step 1 (continue button present).
    expect(screen.getByText(/Enter the guest full name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to payment/i })).toBeInTheDocument();
  });

  it("on Pay, payment methods render and Confirm stays disabled until consent", () => {
    render(<RoomBookingPage />);
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Ada Guest" },
    });
    fireEvent.change(screen.getByLabelText(/^phone$/i), {
      target: { value: "+254700000001" },
    });
    fireEvent.change(screen.getByLabelText(/passport number/i), {
      target: { value: "12345678" },
    });
    // ID front + back are required before advancing (idRequired property).
    const idFile = new File(["x"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/front of id/i), {
      target: { files: [idFile] },
    });
    fireEvent.change(screen.getByLabelText(/back of id/i), {
      target: { files: [idFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(screen.getByRole("radio", { name: /m-pesa/i })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /confirm booking/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /i consent/i }));
    expect(confirm).not.toBeDisabled();
  });
});
