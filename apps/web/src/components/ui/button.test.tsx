import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders a native button (type=button) with its label", () => {
    render(<Button>Book</Button>);
    const button = screen.getByRole("button", { name: "Book" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("applies the primary variant by default and ghost when requested", () => {
    const { rerender } = render(<Button>Primary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-btn-primary");
    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-transparent");
  });

  it("merges caller className over variant classes", () => {
    render(<Button className="w-10">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-10");
  });

  it("fires onClick and respects disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1); // still 1 — disabled blocks the click
  });
});
