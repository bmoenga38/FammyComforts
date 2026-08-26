import { v } from "convex/values";
import { internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  readHostPinnacleConfig,
  buildSendPayload,
  interpretSendResponse,
  type SendOutcome,
} from "./lib/hostpinnacle";

declare const process: { env: Record<string, string | undefined> };

/**
 * Outbound notification engine (Story 10.6, FR56/NFR4). A 5-minute cron drains
 * the `outboundNotifications` queue. Rows are inserted by `guestBookings.create`
 * (booking confirmations) and `housekeeping` (task assignments), each already
 * honoring per-org notificationSettings and rendering the message body at queue
 * time via `lib/messageTemplates.ts`.
 *
 * This module is a courier, not an author: it sends `body` verbatim and never
 * renders or substitutes anything. That keeps the sent text identical to the text
 * stored on the row, so the queue doubles as the delivery record.
 *
 *  - `push` rows are in-app: the bell feed has already shown them, so the
 *    drain marks them sent (delivered) and they age out of the feed.
 *  - `sms` rows POST to HostPinnacle under the approved `AMMY_HOPES` sender ID
 *    when HOSTPINNACLE_USER_ID + HOSTPINNACLE_PASSWORD are set as Convex
 *    environment variables (platform-wide, not per-org). Up to 3 attempts,
 *    then failed with the last gateway error recorded. Payload construction
 *    and response interpretation live in `lib/hostpinnacle.ts`.
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

/**
 * One-off gateway smoke test, for confirming HostPinnacle credentials and the
 * approved sender ID actually work end-to-end:
 *
 *   npx convex run notificationsEngine:sendTest '{"to":"0792697197"}'
 *
 * Deliberately an `internalAction`, not an `action`: internal functions are not
 * reachable from a browser, only from the CLI, the dashboard, or other Convex
 * functions. A public version of this would be an open SMS relay — free credit
 * burn for anyone who found it, and messages sent under your own sender ID.
 *
 * Returns the gateway's raw response so an unrecognised body shape can be read
 * off directly. Never returns or logs the request payload: `password` travels in
 * the body on this provider, and function return values are visible in the
 * Convex dashboard logs.
 */
export const sendTest = internalAction({
  args: { to: v.string(), message: v.optional(v.string()) },
  handler: async (
    _ctx,
    { to, message },
  ): Promise<{
    ok: boolean;
    sentTo: string;
    senderId: string;
    httpStatus: number | null;
    rawResponse: string;
    verdict: string;
  }> => {
    const sms = readHostPinnacleConfig(process.env);
    if (!sms) {
      throw new Error(
        "HostPinnacle is not configured. Set HOSTPINNACLE_USER_ID and " +
          "HOSTPINNACLE_PASSWORD with `npx convex env set`, then retry.",
      );
    }
    // Normalize first so a bad number fails here, before any network call.
    const body = buildSendPayload(sms, [
      {
        mobile: to,
        msg:
          message ??
          "ByteStay test: your booking BK-TEST01 is confirmed. Reply STOP to opt out.",
      },
    ]);
    const res = await fetch(sms.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const rawResponse = await res.text();
    const outcome = interpretSendResponse(res.status, rawResponse);
    return {
      ok: outcome.ok,
      sentTo: body.sms[0].mobile[0],
      senderId: sms.senderId,
      httpStatus: res.status,
      // Capped: the point is to read the shape, not to dump an entire page.
      rawResponse: rawResponse.slice(0, 2000),
      verdict: outcome.ok
        ? "Gateway accepted the message."
        : (outcome.error ?? "Rejected."),
    };
  },
});

export const drain = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; sent: number }> => {
    const queued: QueuedRow[] = await ctx.runQuery(
      internal.notificationsEngine.listQueued,
      {},
    );
    const sms = readHostPinnacleConfig(process.env);
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
      if (n.channel === "sms" && sms) {
        if (!n.recipient) {
          await ctx.runMutation(internal.notificationsEngine.markResult, {
            id: n.id,
            ok: false,
            error: "No recipient phone resolvable",
          });
          continue;
        }
        const message = (n.body ?? "").trim();
        if (!message) {
          // The body is rendered by lib/messageTemplates.ts when the row is
          // queued, so an empty one means the queueing site forgot to render.
          // Deliberately NOT patched over with the type string: sending a guest
          // an SMS reading "booking confirmation" looks like a broken business,
          // costs real credit, and hides the bug. Fail the row instead.
          await ctx.runMutation(internal.notificationsEngine.markResult, {
            id: n.id,
            ok: false,
            error: `No rendered body for ${n.type} — queueing site did not render a message`,
          });
          continue;
        }
        let outcome: SendOutcome;
        try {
          // One request per row: the queue tracks delivery and retries per row.
          // `buildSendPayload` throws on an unroutable number, which lands in
          // the same catch and is recorded as the row's error.
          const res = await fetch(sms.apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              buildSendPayload(sms, [{ mobile: n.recipient, msg: message }]),
            ),
          });
          // HostPinnacle returns rejections as HTTP 200 with an error body, so
          // the body — not `res.ok` — decides whether this actually went out.
          outcome = interpretSendResponse(res.status, await res.text());
        } catch (err) {
          outcome = {
            ok: false,
            error: err instanceof Error ? err.message : "Send failed",
          };
        }
        await ctx.runMutation(internal.notificationsEngine.markResult, {
          id: n.id,
          ok: outcome.ok,
          error: outcome.error,
        });
        if (outcome.ok) sent++;
      }
      // email/whatsapp (and sms with no HostPinnacle config): stay queued.
    }
    return { processed: queued.length, sent };
  },
});
