import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Area, Action } from "./permissions";

/**
 * Org-scoped identity resolution (Epic 2, Story 2.1 — integration spec §2).
 *
 * FammyComfort sessions are minted by `@convex-dev/auth` in the `/sso` route
 * after a Bytebazaar handoff; the session subject is the FammyComfort
 * `users._id`. These helpers are the single seam every tenant-scoped function
 * goes through to (a) authenticate and (b) recover the SSO-resolved `orgId`
 * that the function must filter by. Story 2.3's `requirePermission` layers on
 * top of `requireOrgUser` — it does not replace it.
 *
 * Typed against `QueryCtx`; `MutationCtx` is structurally assignable (its `db`
 * is a superset), so mutations can call these too.
 */

export type OrgIdentity = { user: Doc<"users">; orgId: Id<"organizations"> };

/**
 * The session subject. `@convex-dev/auth` formats it as `"<userId>|<sessionId>"`;
 * `convex-test`'s `withIdentity({ subject })` passes it through verbatim. Taking
 * the segment before `|` handles both (a plain id has no `|`).
 */
function userIdFromSubject(subject: string): Id<"users"> {
  return subject.split("|")[0] as Id<"users">;
}

/** Resolve the signed-in, active org user — or `null` (for `me`-style reads). */
export async function getOptionalOrgUser(
  ctx: QueryCtx,
): Promise<OrgIdentity | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db.get(userIdFromSubject(identity.subject));
  // Inactive / soft-deleted accounts cannot hold a usable session.
  if (!user || !user.isActive) return null;
  return { user, orgId: user.orgId };
}

/** Like {@link getOptionalOrgUser} but throws `UNAUTHENTICATED` when absent. */
export async function requireOrgUser(ctx: QueryCtx): Promise<OrgIdentity> {
  const result = await getOptionalOrgUser(ctx);
  if (!result) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "No active authenticated user for this request.",
    });
  }
  return result;
}

/**
 * Resolve the signed-in user's `area:action` grant set within their org —
 * `userRoles` → `rolePermissions` → `permissions`. The single read path behind
 * both {@link requirePermission} and `roles.myPermissions`.
 */
export async function resolvePermissions(
  ctx: QueryCtx,
  user: Doc<"users">,
  orgId: Id<"organizations">,
): Promise<Set<string>> {
  const userRoles = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  // Defensive: userRoles are org-scoped, but never trust cross-org rows.
  const roleIds = userRoles
    .filter((ur) => ur.orgId === orgId)
    .map((ur) => ur.roleId);

  const granted = new Set<string>();
  for (const roleId of roleIds) {
    const rps = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    for (const rp of rps) {
      const perm = await ctx.db.get(rp.permissionId);
      if (perm) granted.add(`${perm.area}:${perm.action}`);
    }
  }
  return granted;
}

/**
 * Authorization gate (AR6′) — the first line of any permission-protected
 * function. Authenticates + org-scopes via {@link requireOrgUser}, then checks
 * the caller has `area:action`. Returns the org identity on success; throws
 * `UNAUTHENTICATED` (no session) or `FORBIDDEN` (signed in, not granted).
 * Story 2.3's replacement for the superseded NestJS `@RequirePermission`.
 *
 * ── READ-GATING POLICY (deliberate, repo-wide) ───────────────────────────────
 * - **All mutations** call `requirePermission(area, "manage")` and audit.
 * - **Sensitive reads** (staff identities, audit log) call
 *   `requirePermission(area, "read")`.
 * - **Operational / config reads** (property, rooms, room types, amenities,
 *   rate plans, notification settings, roles list) call only `requireOrgUser`
 *   — any authenticated org member may read them; the web gates *display* via
 *   `usePermissions`. This is intentional: rate plans live under "Settings", but
 *   front desk (no `Settings:read`) must read prices to quote a booking, so
 *   gating operational reads by `:read` would break Epic 4. Org-scoping still
 *   applies to every read — never any cross-tenant leak.
 */
export async function requirePermission(
  ctx: QueryCtx,
  area: Area,
  action: Action,
): Promise<OrgIdentity> {
  const identity = await requireOrgUser(ctx);
  const granted = await resolvePermissions(ctx, identity.user, identity.orgId);
  if (!granted.has(`${area}:${action}`)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `${area}:${action}`,
      area,
      action,
    });
  }
  return identity;
}
