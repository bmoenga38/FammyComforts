import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Guest portal (4.8 + 5.7): verified lookup renders status/balance, payments,
 * invoices, and the request box; mismatches show the generic no-match message.
 */
let portalResult: unknown = undefined;
let lastArgs: unknown = null;

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "acme" }),
}));
vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: {
    guestBookings: { portal: "guestBookings.portal" },
    guestRequests: { submit: "guestRequests.submit" },
    mpesa: { initiateStk: "mpesa.initiateStk" },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (_ref: string, args: unknown) => {
    if (args === "skip") return undefined;
    lastArgs = args;
    return portalResult;
  },
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

import PortalPage from "./page";

beforeEach(() => {
  portalResult = undefined;
  lastArgs = null;
});

const PORTAL = {
  reference: "BK-ABC234",
  status: "pending",
  checkInDate: "2099-03-01",
  checkOutDate: "2099-03-04",
  roomNumber: "101",
  roomType: "Deluxe",
  propertyName: "Org acme",
  guestName: "Ada Guest",
  currency: "KES",
  expectedTotalCents: 1218000n,
  balanceCents: 718000n,
  payments: [
    {
      provider: "mpesa_manual",
      status: "confirmed",
      amountCents: 500000n,
      receiptNumber: "QABC123XYZ",
      paidAt: 1,
    },
  ],
  invoices: [
    {
      invoiceId: "inv1",
      number: "INV-ABC234-1",
      isReceipt: false,
      totalCents: 1218000n,
      lines: [{ description: "Stay", amountCents: 1218000n }],
    },
  ],
  requests: [],
};

describe("guest portal page", () => {
  it("shows balance, payments, invoice links, pay box, and request box on a match", () => {
    portalResult = PORTAL;
    render(<PortalPage />);
    fireEvent.change(screen.getByLabelText(/booking reference/i), {
      target: { value: "BK-ABC234" },
    });
    fireEvent.change(screen.getByLabelText(/phone or email/i), {
      target: { value: "+254700000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));

    expect(screen.getByText("BK-ABC234")).toBeInTheDocument();
    expect(screen.getByText(/KES 7,180/)).toBeInTheDocument(); // balance
    expect(screen.getByText(/QABC123XYZ/)).toBeInTheDocument(); // payment
    expect(screen.getByRole("link", { name: /INV-ABC234-1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send stk push/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/request message/i)).toBeInTheDocument();
    expect(lastArgs).toEqual({ reference: "BK-ABC234", contact: "+254700000001" });
  });

  it("hides the pay box when the balance is settled", () => {
    portalResult = { ...PORTAL, balanceCents: 0n };
    render(<PortalPage />);
    fireEvent.change(screen.getByLabelText(/booking reference/i), {
      target: { value: "BK-ABC234" },
    });
    fireEvent.change(screen.getByLabelText(/phone or email/i), {
      target: { value: "+254700000001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /look up/i }));
    expect(screen.queryByRole("button", { name: /send stk push/i })).toBeNull();
  });

  it("shows a generic no-match message", () => {
    portalResult = null;
    render(<PortalPage />);
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
