"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { WORKSPACES, CUSTOMER_NAV, isWorkspaceActive } from "@/lib/workspaces";
import { usePermissions } from "@/lib/use-permissions";
import { roleLabel, initialsOf } from "@/lib/roles";
import { isCustomerRole, isAdminRole } from "@/lib/home-route";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOnlineStatus } from "@/lib/use-online-status";
import { cn } from "@/lib/cn";
import { LogOut } from "lucide-react";

/**
 * The app-shell sidebar, styled per the UI prototype (glass bar, gradient
 * brand-mark "F", Syne wordmark + "Lounge OS" caps label, teal-tinted active
 * nav links, online net-chip). Nav items are gated by the signed-in user's
 * RBAC permissions, so each role sees only its workspaces; the foot shows the
 * logged-in user (name + role) with a sign-out. `onNavigate` lets the mobile
 * drawer close on link follow.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const online = useOnlineStatus();
  const me = useQuery(api.identity.me);
  const { can, isLoading } = usePermissions();
  const { signOut } = useAuthActions();

  // Customers get the guest nav (Home/Book/Trips/Rewards/Profile); admins get
  // the FULL workspace nav (god mode); other staff get their workspaces gated
  // by permission (everything shows while perms load).
  const visible = isCustomerRole(me?.role)
    ? CUSTOMER_NAV
    : isAdminRole(me?.role)
      ? WORKSPACES
      : WORKSPACES.filter((w) => !w.area || isLoading || can(w.area, "read"));

  const handleSignOut = async () => {
    onNavigate?.();
    await signOut();
    router.push("/signin");
  };

  return (
    <div className="glass-bar flex h-full flex-col gap-5 border-r border-[var(--hairline)] px-4 py-5">
      <Link
        href="/"
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
        {visible.map((workspace) => {
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

      <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-3">
        <p className="net-chip self-start">
          <span
            aria-hidden="true"
            className={cn("net-dot", online ? "is-online" : "is-offline")}
          />
          {online ? "Online · PWA ready" : "Offline"}
        </p>

        {/* Signed-in user (bottom-left) — name + role, with sign-out. */}
        {me && (
          <div className="flex items-center gap-3 rounded-ctrl bg-bg-input/60 px-2 py-2">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] font-display text-sm font-bold text-primary"
            >
              {initialsOf(me.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <strong className="truncate text-sm font-semibold text-text">{me.name}</strong>
              <small className="truncate text-label-caps uppercase text-text-muted">
                {roleLabel(me.role)}
              </small>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 shrink-0 place-items-center rounded-ctrl text-text-muted transition-colors hover:bg-bg-card hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <ThemeToggle />
      </div>
    </div>
  );
}
