import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarDays,
  Wrench,
  Brush,
  ChefHat,
  Home,
  Search,
  Luggage,
  Award,
  UserRound,
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
  /**
   * Permission area gating sidebar/bottom-nav visibility (RBAC, Epic 2). A role
   * sees a workspace only if it has `read` on this area. `undefined` = always
   * visible (the guest booking quick link is open to every staff member).
   */
  area?: string;
}

export const WORKSPACES: readonly Workspace[] = [
  {
    slug: "admin",
    href: "/admin",
    navLabel: "Admin",
    bottomLabel: "Admin",
    title: "Admin Dashboard",
    icon: LayoutDashboard,
    inBottomNav: true,
    area: "Settings",
  },
  {
    slug: "front-desk",
    href: "/front-desk",
    navLabel: "Front Desk",
    bottomLabel: "Desk",
    title: "Front Desk Calendar",
    icon: CalendarDays,
    inBottomNav: true,
    area: "Bookings",
  },
  {
    slug: "operations",
    href: "/operations",
    navLabel: "Operations",
    bottomLabel: "Ops",
    title: "Operations Manager",
    icon: Wrench,
    inBottomNav: false,
    area: "Dashboard",
  },
  {
    slug: "housekeeping",
    href: "/housekeeping",
    navLabel: "Housekeeping",
    bottomLabel: "Clean",
    title: "Housekeeping Tasks",
    icon: Brush,
    inBottomNav: true,
    area: "Housekeeping",
  },
  {
    slug: "kitchen",
    href: "/kitchen",
    navLabel: "Kitchen",
    bottomLabel: "Kitchen",
    title: "Kitchen Display",
    icon: ChefHat,
    inBottomNav: true,
    area: "Restaurant",
  },
] as const;

/**
 * Customer-facing nav (prototype customer role: Home · Book · Trips · Rewards ·
 * Profile). Shown instead of the staff workspaces when the signed-in user is a
 * customer. "Book" leaves the shell for the public catalog.
 */
export interface NavItem {
  slug: string;
  href: string;
  navLabel: string;
  bottomLabel: string;
  icon: LucideIcon;
}

export const CUSTOMER_NAV: readonly NavItem[] = [
  { slug: "home", href: "/guest", navLabel: "Home", bottomLabel: "Home", icon: Home },
  { slug: "book", href: "/book", navLabel: "Book", bottomLabel: "Book", icon: Search },
  { slug: "trips", href: "/trips", navLabel: "Trips", bottomLabel: "Trips", icon: Luggage },
  { slug: "rewards", href: "/rewards", navLabel: "Rewards", bottomLabel: "Rewards", icon: Award },
  { slug: "profile", href: "/profile", navLabel: "Profile", bottomLabel: "Profile", icon: UserRound },
] as const;

/** The default workspace `/` lands on. */
export const DEFAULT_WORKSPACE: Workspace = WORKSPACES[0];

/** Lookup by slug, e.g. `WORKSPACE_BY_SLUG.guest` — typed, no non-null asserts. */
export const WORKSPACE_BY_SLUG = Object.fromEntries(
  WORKSPACES.map((w) => [w.slug, w]),
) as Record<WorkspaceSlug, Workspace>;

/** True when `pathname` is the item's route or a child of it. */
export function isWorkspaceActive(item: { href: string }, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The workspace matching the current pathname, if any. */
export function workspaceForPathname(pathname: string): Workspace | undefined {
  return WORKSPACES.find((w) => isWorkspaceActive(w, pathname));
}
