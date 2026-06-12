import { v } from "convex/values";
import { internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

/**
 * Outbound notification engine (Story 10.6, FR56/NFR4). A 5-minute cron drains
 * the `outboundNotifications` queue (rows are inserted by booking/payment/
 * assignment flows, already honoring per-org notificationSettings at queue
 * time):
 *
 *  - `push` rows are in-app: the bell feed has already shown them, so the
 *    drain marks them sent (delivered) and they age out of the feed.
 *  - `sms` rows POST to the property's own SMS gateway (two-layer model: own
 *    SenderID) when SMS_GATEWAY_URL + SMS_API_KEY are configured. Up to 3
 *    attempts, then failed with the last error recorded.
 *  - `email`/`whatsapp` (and sms with NO gateway configured) stay queued —
 *    honest pending state, visible in the feed, picked up once a provider is
 *    configured. No fake "sent".
 */

const MAX_ATTEMPTS = 3;

// Explicit row + return types: this module's action calls its own internal
// functions via `internal.*`, which is circular for TS inference without them.
type QueuedRow = {
  id: Id<"outboundNotifications">;
  channel: "email" | "sms" | "whatsapp" | "push";
  type: string;
  body: string | null;
  recipient: string | null;
  attempts: number;
};

export const listQueued = internalQuery({
  args: {},
  handler: async (ctx): Promise<QueuedRow[]> => {
    const queued = await ctx.db
      .query("outboundNotifications")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .take(50);
    const out: QueuedRow[] = [];
    for (const n of queued) {
      // Resolve a missing SMS recipient from the booking's guest phone.
      let recipient = n.recipient ?? null;
      if (!recipient && n.channel === "sms" && n.bookingId) {
        const booking = await ctx.db.get(n.bookingId);
        const guest = booking ? await ctx.db.get(booking.guestId) : null;
        recipient = guest?.phone ?? null;
      }
      out.push({
        id: n._id,
        channel: n.channel,
        type: n.type,
        body: n.body ?? null,
        recipient,
        attempts: n.attempts ?? 0,
      });
    }
    return out;
  },
});

export const markResult = internalMutation({
  args: {
    id: v.id("outboundNotifications"),
    ok: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, ok, error }): Promise<void> => {
    const n = await ctx.db.get(id);
    if (!n || n.status !== "queued") return;
    const attempts = (n.attempts ?? 0) + 1;
    if (ok) {
      await ctx.db.patch(id, { status: "sent", sentAt: Date.now(), attempts });
    } else if (attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch(id, { status: "failed", attempts, error });
    } else {
      await ctx.db.patch(id, { attempts, error });
    }
  },
});

export const drain = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; sent: number }> => {
    const queued: QueuedRow[] = await ctx.runQuery(
      internal.notificationsEngine.listQueued,
      {},
    );
    const gatewayUrl = process.env.SMS_GATEWAY_URL;
    const apiKey = process.env.SMS_API_KEY;
    let sent = 0;
    for (const n of queued) {
      if (n.channel === "push") {
        // In-app: the live feed already delivered it.
        await ctx.runMutation(internal.notificationsEngine.markResult, {
          id: n.id,
          ok: true,
        });
        sent++;
        continue;
      }
      if (n.channel === "sms" && gatewayUrl && apiKey) {
        if (!n.recipient) {
          await ctx.runMutation(internal.notificationsEngine.markResult, {
            id: n.id,
            ok: false,
            error: "No recipient phone resolvable",
          });
          continue;
        }
        try {
          const res = await fetch(gatewayUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              to: n.recipient,
              from: process.env.SMS_SENDER_ID ?? "FammyComfort",
              message: n.body ?? n.type.replaceAll("_", " "),
            }),
          });
          await ctx.runMutation(internal.notificationsEngine.markResult, {
            id: n.id,
            ok: res.ok,
            error: res.ok ? undefined : `Gateway HTTP ${res.status}`,
          });
          if (res.ok) sent++;
        } catch (err) {
          await ctx.runMutation(internal.notificationsEngine.markResult, {
            id: n.id,
            ok: false,
            error: err instanceof Error ? err.message : "Send failed",
          });
        }
      }
      // email/whatsapp (and sms without a gateway): stay queued.
    }
    return { processed: queued.length, sent };
  },
});
