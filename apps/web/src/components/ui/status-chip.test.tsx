import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusChip, type Status } from "./status-chip";

describe("StatusChip", () => {
  it("renders its label and the status color classes (AA-tuned fg + tinted bg)", () => {
    render(<StatusChip status="success">Paid</StatusChip>);
    const chip = screen.getByText("Paid");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveClass("text-badge-success-fg");
    expect(chip).toHaveClass("bg-badge-success");
  });

  it("maps each status to its color utility", () => {
    const { rerender } = render(<StatusChip status="danger">x</StatusChip>);
    expect(screen.getByText("x")).toHaveClass("text-badge-danger-fg");
    rerender(<StatusChip status="warning">x</StatusChip>);
    expect(screen.getByText("x")).toHaveClass("text-badge-warning-fg");
  });

  it("falls back to a neutral style and an sr-only label for an unknown status", () => {
    // Simulate a non-TS / JSON caller passing a server status outside the union.
    render(<StatusChip status={"occupied" as unknown as Status} />);
    const srOnly = screen.getByText("occupied");
    expect(srOnly).toHaveClass("sr-only");
    expect(srOnly.parentElement).toHaveClass("text-badge-info-fg");
  });

  it("renders a decorative icon as aria-hidden", () => {
    render(
      <StatusChip status="success" icon={<svg data-testid="icon" />}>
        Done
      </StatusChip>,
    );
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});
