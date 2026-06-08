import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./segmented-control";

const options = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Premium", value: "premium" },
];

describe("SegmentedControl", () => {
  it("renders a radiogroup and marks the active option", () => {
    render(<SegmentedControl aria-label="Filter" options={options} value="all" onValueChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Filter" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Available" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onValueChange when a segment is clicked", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl aria-label="Filter" options={options} value="all" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("radio", { name: "Available" }));
    expect(onValueChange).toHaveBeenCalledWith("available");
  });

  it("moves selection with arrow keys", () => {
    const onValueChange = vi.fn();
    render(<SegmentedControl aria-label="Filter" options={options} value="all" onValueChange={onValueChange} />);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith("available");
  });
});
