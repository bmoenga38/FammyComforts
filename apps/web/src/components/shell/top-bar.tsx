"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { workspaceForPathname } from "@/lib/workspaces";
import { NotificationsBell } from "./notifications-bell";
import { GlobalSearch } from "./global-search";

/**
 * The app-shell top bar, styled per the UI prototype (62px glass bar over the
 * mesh backdrop): mobile menu button, workspace title (Space Grotesk) with a
 * muted subtitle, search + notifications affordances.
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
    <header className="glass-bar sticky top-0 z-30 flex h-[62px] items-center gap-3 border-b border-[var(--hairline)] px-4 lg:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        className="icon-btn lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-col leading-tight">
        <h1 className="truncate font-display text-headline-sm text-text">
          {workspace?.title ?? "Fammy Comforts"}
        </h1>
        <p className="hidden text-body-md text-text-muted sm:block">
          Rental operations suite
        </p>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch />
        <NotificationsBell />
      </div>
    </header>
  );
}
