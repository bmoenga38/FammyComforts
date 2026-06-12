import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/** Live bell: real badge count + dropdown items; no badge when caught up. */
let feed: { count: number; items: { kind: string; title: string; detail: string; tone: string; at: number }[] } | undefined;

vi.mock("@fammycomforts/backend/convex/_generated/api", () => ({
  api: { notificationsFeed: { feed: "notificationsFeed.feed" } },
}));
vi.mock("convex/react", () => ({
  useQuery: () => feed,
}));

import { NotificationsBell } from "./notifications-bell";

beforeEach(() => {
  feed = undefined;
});

describe("NotificationsBell", () => {
  it("shows the live count badge and lists items on open", () => {
    feed = {
      count: 2,
      items: [
        { kind: "booking_pending", title: "New booking BK-ABC234", detail: "Ada Guest · Rm 101 · 2099-03-01", tone: "warning", at: Date.now() - 120000 },
        { kind: "sms_queued", title: "SMS queued: booking confirmation", detail: "sms · BK-ABC234", tone: "success", at: Date.now() - 3600000 },
      ],
    };
    render(<NotificationsBell />);
    expect(screen.getByText("2")).toBeInTheDocument(); // badge

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText("New booking BK-ABC234")).toBeInTheDocument();
    expect(screen.getByText(/Ada Guest · Rm 101/)).toBeInTheDocument();
    expect(screen.getByText(/SMS queued/)).toBeInTheDocument();
    expect(screen.getByText("2m ago")).toBeInTheDocument();
  });

  it("hides the badge at zero and shows the caught-up state", () => {
    feed = { count: 0, items: [] };
    render(<NotificationsBell />);
    expect(screen.queryByText("0")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});
