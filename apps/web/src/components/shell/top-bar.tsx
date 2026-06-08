"use client";

import { usePathname } from "next/navigation";
import { Menu, Search, Bell } from "lucide-react";
import { workspaceForPathname } from "@/lib/workspaces";

/**
 * The app-shell top bar: a mobile menu button (opens the sidebar drawer), the
 * active workspace title (the page `<h1>`, derived from the route to match the
 * prototype's `pageTitle`), and static search + notifications affordances. The
 * search/notifications behavior is intentionally non-functional in Story 1.7.
 */
export function TopBar({
  menuOpen,
  onOpenMenu,
}: {
  menuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const workspace = workspaceForPathname(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        className="grid size-11 shrink-0 place-items-center rounded-lg text-text-dim hover:bg-bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-col leading-tight">
        <p className="font-mono text-xs text-text-muted">Rental operations suite</p>
        <h1 className="truncate font-display text-lg font-semibold text-text">
          {workspace?.title ?? "SommyComfort"}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="hidden items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-dim sm:flex">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Search bookings, guests, rooms</span>
          <input
            type="search"
            placeholder="Search bookings, guests, rooms"
            className="w-48 bg-transparent text-text placeholder:text-text-muted focus:outline-none"
          />
        </label>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-11 shrink-0 place-items-center rounded-lg text-text-dim hover:bg-bg-input hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          <Bell className="size-5" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute right-2.5 top-2.5 size-2 rounded-full bg-badge-danger-fg"
          />
        </button>
      </div>
    </header>
  );
}
