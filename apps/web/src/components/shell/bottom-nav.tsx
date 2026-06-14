"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { WORKSPACES, CUSTOMER_NAV, isWorkspaceActive } from "@/lib/workspaces";
import { usePermissions } from "@/lib/use-permissions";
import { isCustomerRole } from "@/lib/home-route";
import { cn } from "@/lib/cn";

/**
 * Fixed mobile bottom nav (64px glass bar per the prototype — max 5 items;
 * active item glows teal). Hidden on desktop where the sidebar takes over.
 * Customers get the guest nav; staff get permission-gated workspaces (matching
 * the sidebar). Padded for the iOS home indicator via `safe-area-inset-bottom`.
 */
export function BottomNav() {
  const pathname = usePathname();
  const me = useQuery(api.identity.me);
  const { can, isLoading } = usePermissions();
  const items = isCustomerRole(me?.role)
    ? CUSTOMER_NAV
    : WORKSPACES.filter(
        (w) => w.inBottomNav && (!w.area || isLoading || can(w.area, "read")),
      );

  return (
    <nav
      aria-label="Quick navigation"
      className="glass-bar fixed inset-x-0 bottom-0 z-30 flex h-[64px] border-t border-[var(--hairline)] pb-[env(safe-area-inset-bottom)] lg:hidden"
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
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold tracking-[0.02em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
              active ? "text-primary" : "text-text-muted hover:text-text",
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
            {workspace.bottomLabel}
          </Link>
        );
      })}
    </nav>
  );
}
