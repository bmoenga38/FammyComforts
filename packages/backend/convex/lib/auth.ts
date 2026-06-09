import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

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
