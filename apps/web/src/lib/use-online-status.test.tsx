import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useOnlineStatus } from "./use-online-status";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

function Probe() {
  return <span>{useOnlineStatus() ? "online" : "offline"}</span>;
}

describe("useOnlineStatus", () => {
  let original: boolean;
  beforeEach(() => {
    original = navigator.onLine;
  });
  afterEach(() => setOnline(original));

  it("reflects navigator.onLine and updates on online/offline events", () => {
    setOnline(true);
    render(<Probe />);
    expect(screen.getByText("online")).toBeInTheDocument();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText("offline")).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByText("online")).toBeInTheDocument();
  });
});
