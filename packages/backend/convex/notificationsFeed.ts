import { query } from "./_generated/server";
import { requireOrgUser, resolvePermissions } from "./lib/auth";

/**
 * The in-app notification feed (replaces the static bell). Org-scoped and
 * PERMISSION-AWARE: each item kind is included only when the caller's resolved
 * permission set grants the matching area, so every role sees its own feed:
 *  - booking_pending  (Bookings:read)      — new website bookings awaiting desk
 *  - guest_request    (Bookings:read)      — open portal requests
 *  - housekeeping     (Housekeeping:read)  — pending cleaning tasks
 *  - sms_queued       (Notifications:read) — outbound messages awaiting send
 * Stateless live counts (no read/unread state yet — gap-listed); newest-first,
 * capped at 30 items. `count` is the badge number.
 */
export type FeedItem = {
  kind: "booking_pending" | "guest_request" | "housekeeping" | "sms_queued";
  title: string;
  detail: string;
  tone: "success" | "info" | "warning" | "danger";
  at: number;
};

export const feed = query({
  args: {},
  handler: async (ctx) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const perms = await resolvePermissions(ctx, user, orgId);
    const items: FeedItem[] = [];

    if (perms.has("Bookings:read")) {
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const b of bookings) {
        if (b.status !== "pending") continue;
        const guest = await ctx.db.get(b.guestId);
        const room = await ctx.db.get(b.roomId);
        items.push({
          kind: "booking_pending",
          title: `New booking ${b.reference}`,
          detail: `${guest?.fullName ?? "Guest"} · Rm ${room?.number ?? "?"} · ${b.checkInDate}`,
          tone: "warning",
          at: b._creationTime,
        });
      }

      const requests = await ctx.db
        .query("guestRequests")
        .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "open"))
        .collect();
      for (const r of requests) {
        const booking = await ctx.db.get(r.bookingId);
        items.push({
          kind: "guest_request",
          title: "Guest request",
          detail: `${r.message} · ${booking?.reference ?? ""}`.trim(),
          tone: "info",
          at: r._creationTime,
        });
      }
    }

    if (perms.has("Housekeeping:read")) {
      const tasks = await ctx.db
        .query("housekeepingTasks")
        .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "pending"))
        .collect();
      for (const t of tasks) {
        const room = await ctx.db.get(t.roomId);
        items.push({
          kind: "housekeeping",
          title: `Cleaning · Rm ${room?.number ?? "?"}`,
          detail: t.notes ?? "Housekeeping task pending",
          tone: "warning",
          at: t._creationTime,
        });
      }
    }

    if (perms.has("Notifications:read")) {
      const queued = await ctx.db
        .query("outboundNotifications")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const n of queued) {
        if (n.status !== "queued") continue;
        const booking = n.bookingId ? await ctx.db.get(n.bookingId) : null;
        items.push({
          kind: "sms_queued",
          title: `SMS queued: ${n.type.replaceAll("_", " ")}`,
          detail: `${n.channel}${booking ? ` · ${booking.reference}` : ""}`,
          tone: "success",
          at: n._creationTime,
        });
      }
    }

    items.sort((a, b) => b.at - a.at);
    return { count: items.length, items: items.slice(0, 30) };
  },
});
