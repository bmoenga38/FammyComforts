import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  localStorage.clear();
  // The inline layout script sets this before paint; emulate the default here.
  document.documentElement.dataset.theme = "dark";
});

describe("ThemeToggle", () => {
  it("reflects the current theme (dark by default)", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Dark");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("aria-label", "Toggle color theme");
  });

  it("toggles to light, updates <html data-theme>, and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("fammycomforts-theme")).toBe("light");
    expect(screen.getByRole("button")).toHaveTextContent("Light");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles back to dark on a second click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button");

    await user.click(button);
    await user.click(button);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("fammycomforts-theme")).toBe("dark");
  });

  it("syncs across tabs via the storage event", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toHaveTextContent("Dark");

    // Another tab changed the stored theme → native storage event fires.
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "fammycomforts-theme", newValue: "light" }),
      );
    });

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button")).toHaveTextContent("Light");
  });

  it("still applies the theme when localStorage.setItem throws (private mode)", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("localStorage blocked");
      });
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button"));

    // Theme still applies for the session even though persistence failed.
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button")).toHaveTextContent("Light");
    setItem.mockRestore();
  });
});
