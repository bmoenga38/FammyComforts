"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hotel } from "lucide-react";
import { WORKSPACES, isWorkspaceActive } from "@/lib/workspaces";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/cn";

/**
 * The app-shell sidebar: brand, the six workspace nav items (active state driven
 * by the real pathname so deep links highlight correctly), an offline/PWA status
 * pill, and the theme toggle. Rendered persistently on desktop and inside the
 * mobile drawer (positioning is owned by AppShell). `onNavigate` lets the drawer
 * close when a link is followed.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const online = useOnlineStatus();

  return (
    <div className="flex h-full flex-col gap-6 border-r border-border bg-bg-card px-4 py-6">
      <Link
        href="/guest"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-btn-primary text-on-primary"
        >
          <Hotel className="size-5" />
        </span>
        <span className="flex flex-col leading-tight">
          <strong className="font-display text-sm text-text">Fammy Comforts</strong>
          <small className="text-xs text-text-muted">Accommodation PWA</small>
        </span>
      </Link>

      <nav aria-label="Workspaces" className="flex flex-1 flex-col gap-1">
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
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                active
                  ? "bg-bg-input text-text"
                  : "text-text-dim hover:bg-bg-input hover:text-text",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {workspace.navLabel}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-dim">
          <span
            aria-hidden="true"
            className={cn(
              "size-2 shrink-0 rounded-full",
              online ? "bg-badge-success-fg" : "bg-badge-warning-fg",
            )}
          />
          {online ? "Online · PWA ready" : "Offline"}
        </p>
        <ThemeToggle />
      </div>
    </div>
  );
}
