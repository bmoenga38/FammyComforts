"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACES, isWorkspaceActive } from "@/lib/workspaces";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/cn";

/**
 * The app-shell sidebar, styled per the UI prototype (glass bar, gradient
 * brand-mark "F", Syne wordmark + "Lounge OS" caps label, teal-tinted active
 * nav links, online net-chip). Six workspace nav items driven by the real
 * pathname; `onNavigate` lets the mobile drawer close on link follow.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const online = useOnlineStatus();

  return (
    <div className="glass-bar flex h-full flex-col gap-5 border-r border-[var(--hairline)] px-4 py-5">
      <Link
        href="/guest"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-ctrl px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        <span aria-hidden="true" className="brand-mark size-10 text-xl">
          F
        </span>
        <span className="flex flex-col leading-tight">
          <strong className="font-hero text-[18px] font-extrabold text-text">
            Fammy Comforts
          </strong>
          <small className="text-label-caps uppercase text-text-muted">Lounge OS</small>
        </span>
      </Link>

      <nav aria-label="Workspaces" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {WORKSPACES.map((workspace) => {
          const active = isWorkspaceActive(workspace, pathname);
          const Icon = workspace.icon;
          return (
            <Link
              key={workspace.slug}
              href={workspace.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-ctrl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                active
                  ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary"
                  : "text-text-muted hover:bg-bg-input hover:text-text",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {workspace.navLabel}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3">
        <p className="net-chip self-start">
          <span
            aria-hidden="true"
            className={cn("net-dot", online ? "is-online" : "is-offline")}
          />
          {online ? "Online · PWA ready" : "Offline"}
        </p>
        <ThemeToggle />
      </div>
    </div>
  );
}
