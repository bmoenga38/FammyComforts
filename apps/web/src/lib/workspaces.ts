import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  LayoutDashboard,
  CalendarDays,
  Wrench,
  Brush,
  ChefHat,
} from "lucide-react";

/**
 * Single source of truth for the six role workspaces (Story 1.7).
 * The `prototype/` is the binding layout reference — titles match its
 * `titleByView` map, and `inBottomNav` matches the prototype's 5-item bottom nav.
 *
 * Auth/RBAC do not exist yet (Epic 2). When they land, the architecture's
 * `(guest)` (public) vs `(staff)` (guarded) route-group split will be applied
 * and `inBottomNav` / nav visibility gated by permission.
 */
export type WorkspaceSlug =
  | "guest"
  | "admin"
  | "front-desk"
  | "operations"
  | "housekeeping"
  | "kitchen";

export interface Workspace {
  slug: WorkspaceSlug;
  /** Route path, e.g. `/front-desk`. */
  href: string;
  /** Sidebar label. */
  navLabel: string;
  /** Short label for the mobile bottom nav. */
  bottomLabel: string;
  /** Top-bar heading + browser tab title. */
  title: string;
  icon: LucideIcon;
  /** Whether this workspace appears in the mobile bottom nav (prototype: 5 of 6). */
  inBottomNav: boolean;
}

export const WORKSPACES: readonly Workspace[] = [
  {
    slug: "guest",
    href: "/guest",
    navLabel: "Guest Booking",
    bottomLabel: "Book",
    title: "Guest Booking",
    icon: BedDouble,
    inBottomNav: true,
  },
  {
    slug: "admin",
    href: "/admin",
    navLabel: "Admin",
    bottomLabel: "Admin",
    title: "Admin Dashboard",
    icon: LayoutDashboard,
    inBottomNav: true,
  },
  {
    slug: "front-desk",
    href: "/front-desk",
    navLabel: "Front Desk",
    bottomLabel: "Desk",
    title: "Front Desk Calendar",
    icon: CalendarDays,
    inBottomNav: true,
  },
  {
    slug: "operations",
    href: "/operations",
    navLabel: "Operations",
    bottomLabel: "Ops",
    title: "Operations Manager",
    icon: Wrench,
    inBottomNav: false,
  },
  {
    slug: "housekeeping",
    href: "/housekeeping",
    navLabel: "Housekeeping",
    bottomLabel: "Clean",
    title: "Housekeeping Tasks",
    icon: Brush,
    inBottomNav: true,
  },
  {
    slug: "kitchen",
    href: "/kitchen",
    navLabel: "Kitchen",
    bottomLabel: "Kitchen",
    title: "Kitchen Display",
    icon: ChefHat,
    inBottomNav: true,
  },
] as const;

/** The default workspace `/` lands on. */
export const DEFAULT_WORKSPACE: Workspace = WORKSPACES[0];

/** Lookup by slug, e.g. `WORKSPACE_BY_SLUG.guest` — typed, no non-null asserts. */
export const WORKSPACE_BY_SLUG = Object.fromEntries(
  WORKSPACES.map((w) => [w.slug, w]),
) as Record<WorkspaceSlug, Workspace>;

/** True when `pathname` is the workspace route or a child of it. */
export function isWorkspaceActive(workspace: Workspace, pathname: string): boolean {
  return pathname === workspace.href || pathname.startsWith(`${workspace.href}/`);
}

/** The workspace matching the current pathname, if any. */
export function workspaceForPathname(pathname: string): Workspace | undefined {
  return WORKSPACES.find((w) => isWorkspaceActive(w, pathname));
}
