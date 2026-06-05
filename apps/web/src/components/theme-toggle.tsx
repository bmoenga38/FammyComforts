"use client";

import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "sommycomfort-theme";
const CHANGE_EVENT = "sommycomfort:themechange";

/**
 * Toggles the SommyComfort theme. The initial theme is applied before paint by
 * the inline script in the root layout (no-FOUC). This component reads the live
 * `<html data-theme>` value via useSyncExternalStore (hydration-safe — the server
 * snapshot is the default `dark`, the client snapshot reads the real attribute),
 * keeps the attribute + localStorage in sync on click, and stays consistent
 * across tabs via the native `storage` event.
 */
function subscribe(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    const next: Theme = e.newValue === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode / blocked) — theme still applies this session.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      aria-pressed={theme === "dark"}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-card px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-bg-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    >
      <span aria-hidden="true">{theme === "dark" ? "🌙" : "☀️"}</span>
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
