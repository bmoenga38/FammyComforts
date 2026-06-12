"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import { cn } from "@/lib/cn";

/**
 * The persistent application shell that wraps every workspace route: a sidebar
 * (persistent on desktop, an off-canvas drawer on mobile), a top bar, and the
 * mobile bottom nav. Owns only the mobile drawer open/close state — trivial
 * local UI state, so no Zustand store yet (architecture.md: Zustand for shared
 * UI state when it actually appears). The drawer closes on route change, scrim
 * tap, link selection, and Escape.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes. Adjusting state during
  // render off a changed value is React's recommended pattern over an effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  // Escape closes the open drawer (subscribing to an external event — the
  // allowed effect pattern; setState happens inside the listener callback).
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="min-h-full">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-bg-card px-4 py-2 text-sm font-medium text-text focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-border-focus"
      >
        Skip to content
      </a>

      {/* Sidebar: persistent on desktop, off-canvas drawer on mobile. When the
          drawer is closed on mobile it is `invisible` so its links leave the tab
          order and a11y tree; `lg:visible` keeps it active on desktop. */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[280px] transition-transform duration-200 ease-out lg:visible lg:translate-x-0",
          menuOpen ? "visible translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <Sidebar onNavigate={() => setMenuOpen(false)} />
      </div>

      {/* Scrim: only on mobile while the drawer is open. */}
      {menuOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-bg-deep/60 lg:hidden"
        />
      ) : null}

      <div className="flex min-h-full flex-col lg:pl-[280px]">
        <TopBar menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 pb-24 focus:outline-none lg:px-6 lg:pb-6"
        >
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
