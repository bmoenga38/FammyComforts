import { query } from "./_generated/server";
import { requireOrgUser, resolvePermissions } from "./lib/auth";

/**
 * The in-app notification feed (replaces the static bell). Org-scoped and
 * PERMISSION-AWARE: each item kind is included only when the caller's resolved
 * permission set grants the matching area, so every role sees its own feed:
 *  - booking_pending  (Bookings:read)      — new website bookings awaiting desk
 *  - guest_request    (Bookings:read)      — open portal requests
 *  - housekeeping     (Housekeeping:read)  — pending cleaning tasks
 *  - escalation       (Dashboard:read)     — open escalations
 *  - sms_queued       (Notifications:read) — outbound messages awaiting send
 * Stateless live counts (no read/unread state yet — gap-listed); newest-first,
 * capped at 30 items. `count` is the badge number.
 */
export type FeedItem = {
  kind:
    | "booking_pending"
    | "guest_request"
    | "housekeeping"
    | "sms_queued"
    | "escalation";
  title: string;
  detail: string;
  tone: "success" | "info" | "warning" | "danger";
  at: number;
};

/** Items returned to the bell dropdown. */
const FEED_LIMIT = 30;

/**
 * Rows read per kind. Every read here is bounded, which matters because this
 * query runs on every page for every signed-in user and is live-subscribed:
 * it re-runs on any write to a table it touched. It used to `.collect()` the
 * whole `bookings` and `outboundNotifications` tables and filter in JS, so its
 * cost grew with the property's entire history — and past Convex's per-query
 * read limit the bell would have stopped working altogether, exactly when the
 * property was busiest.
 *
 * Set equal to `FEED_LIMIT`, which makes the cap invisible in the returned
 * list: the rows dropped by a kind's `.take()` are all older than that kind's
 * newest `FEED_LIMIT`, so they cannot rank inside the newest `FEED_LIMIT`
 * overall. The returned items are therefore identical to an unbounded read.
 *
 * `count` does saturate (at `FEED_LIMIT` × kinds). Not user-visible: the bell
 * badge renders "9+" for anything above 9 (see notifications-bell.tsx).
 */
const SCAN_LIMIT = FEED_LIMIT;

export const feed = query({
  args: {},
  handler: async (ctx) => {
    const { user, orgId } = await requireOrgUser(ctx);
    const perms = await resolvePermissions(ctx, user, orgId);
    const items: FeedItem[] = [];

    if (perms.has("Bookings:read")) {
      // `by_org_status` + desc = the newest pending bookings, without reading
      // the confirmed/checked-out/cancelled archive at all.
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", "pending"),
        )
        .order("desc") // every Convex index ends with _creationTime → newest first
        .take(SCAN_LIMIT);
      for (const b of bookings) {
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
        .order("desc")
        .take(SCAN_LIMIT);
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
        .order("desc")
        .take(SCAN_LIMIT);
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

    if (perms.has("Dashboard:read")) {
      const escalations = await ctx.db
        .query("escalations")
        .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "open"))
        .order("desc")
        .take(SCAN_LIMIT);
      for (const e of escalations) {
        items.push({
          kind: "escalation",
          title: `Escalation: ${e.trigger.replaceAll("_", " ")}`,
          detail: e.message,
          tone: "danger",
          at: e._creationTime,
        });
      }
    }

    if (perms.has("Notifications:read")) {
      const queued = await ctx.db
        .query("outboundNotifications")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", orgId).eq("status", "queued"),
        )
        .order("desc")
        .take(SCAN_LIMIT);
      for (const n of queued) {
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
    return { count: items.length, items: items.slice(0, FEED_LIMIT) };
  },
});
