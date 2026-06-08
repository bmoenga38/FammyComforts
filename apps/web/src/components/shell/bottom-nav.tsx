"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACES, isWorkspaceActive } from "@/lib/workspaces";
import { cn } from "@/lib/cn";

/**
 * Fixed mobile bottom nav exposing the primary workspaces (the 5-item subset
 * from the prototype). Hidden on desktop (the persistent sidebar takes over).
 * Padded for the iOS home indicator via `safe-area-inset-bottom`.
 */
export function BottomNav() {
  const pathname = usePathname();
  const items = WORKSPACES.filter((w) => w.inBottomNav);

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((workspace) => {
        const active = isWorkspaceActive(workspace, pathname);
        const Icon = workspace.icon;
        return (
          <Link
            key={workspace.slug}
            href={workspace.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // Inset focus ring (negative offset) so it isn't clipped at the screen's bottom edge.
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
              active ? "text-text" : "text-text-dim hover:text-text",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {workspace.bottomLabel}
          </Link>
        );
      })}
    </nav>
  );
}
