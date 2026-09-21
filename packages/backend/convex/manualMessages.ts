import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { userError } from "./lib/errors";
import {
  TEMPLATE_VARIABLES,
  unknownPlaceholders,
  renderNotification,
  smsSegments,
  type TemplateVars,
} from "./lib/messageTemplates";
import {
  readHostPinnacleConfig,
  normalizeSmsMsisdn,
  buildSendPayload,
  interpretSendResponse,
  type SendOutcome,
} from "./lib/hostpinnacle";

declare const process: { env: Record<string, string | undefined> };

/**
 * Ad-hoc "send one SMS to one number" from /admin/setup → Notifications.
 *
 * Everything else that sends is triggered by an event (a booking, a housekeeping
 * assignment) and drains on the 5-minute cron. This is the one path where a
 * human types a number and a message and presses send, so it is also the one
 * path that needs guarding on purpose rather than by accident.
 *
 * **Why this is a public `action` when `notificationsEngine.sendTest` is
 * deliberately internal.** That comment is right: an unauthenticated public
 * send endpoint is an open SMS relay — anyone who found it could burn the
 * property's credit and send messages under its approved sender ID. This module
 * is reachable from the browser because the admin UI has to call it, so it
 * carries the four guards that make that safe:
 *
 *  1. `Notifications:manage` permission, checked server-side in a mutation
 *     (`ctx.runMutation` from an action propagates the caller's identity).
 *  2. A per-org hourly cap. Permission alone is not enough — it only takes one
 *     borrowed laptop or one stolen session to drain an SMS balance, and the
 *     bill is real money.
 *  3. The number is normalized and the message fully rendered BEFORE the
 *     network call, so a typo costs nothing.
 *  4. Every attempt is written to `outboundNotifications` and `auditLogs`,
 *     sent or not. A manual send is exactly the kind that gets disputed later.
 */

/**
 * Manual sends allowed per org per hour.
 *
 * Generous for the real use (chasing one guest about a late check-in, resending
 * a confirmation that never arrived) and far too small to be worth abusing. If a
 * property genuinely needs to message 30 people at once, that is a bulk-send
 * feature with its own consent and opt-out story, not this.
 */
export const MANUAL_HOURLY_LIMIT = 20;

/** Window the limit is measured over. */
export const MANUAL_WINDOW_MS = 60 * 60_000;

/**
 * Longest message this will send, in SMS segments.
 *
 * Each segment is separately billed, so a pasted paragraph is a silent 8x
 * charge. The editor shows the count live; this refuses the extreme case rather
 * than trusting anyone to read it.
 */
export const MAX_SEGMENTS = 4;

/** The `type` written to `outboundNotifications` for these rows. */
export const MANUAL_TYPE = "manual";

type Prepared = {
  id: Id<"outboundNotifications">;
  recipient: string;
  message: string;
};

/**
 * Authorize, validate, and record the intent to send — all in one mutation so
 * the permission check and the row that proves it happened cannot come apart.
 *
 * The row is inserted as `queued`, the same state the cron uses. That matters:
 * if the action dies between here and the gateway call (a deploy, a timeout),
 * the row is not lost — the 5-minute drain finds it and sends it, with the
 * normal 3-attempt retry. The failure mode is a late message, not a silent one.
 */
export const prepare = internalMutation({
  args: {
    to: v.string(),
    type: v.string(),
    body: v.string(),
    vars: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { to, type, body, vars }): Promise<Prepared> => {
    const { user, orgId } = await requirePermission(
      ctx,
      "Notifications",
      "manage",
    );

    const draft = body.trim();
    if (!draft) userError("Type a message first.");

    // Reject unknown placeholders here, not at send time — same reasoning as
    // `notifications.saveTemplate`: the alternatives are charging for a message
    // reading "Hi {{guestname}}" or silently dropping the admin's wording.
    const unknown = unknownPlaceholders(draft);
    if (unknown.length > 0) {
      userError(
        `Unknown placeholder${unknown.length > 1 ? "s" : ""} ` +
          `${unknown.map((u) => `{{${u}}}`).join(", ")}. ` +
          `Available: ${TEMPLATE_VARIABLES.map((t) => `{{${t}}}`).join(", ")}.`,
      );
    }

    // Normalize before anything else is written. `normalizeSmsMsisdn` throws a
    // plain Error, which Convex REDACTS on production — so the admin would see
    // "Server Error <id>" instead of "that number is not routable". Re-throw it
    // as a ConvexError so the sentence actually reaches them.
    let recipient: string;
    try {
      recipient = normalizeSmsMsisdn(to);
    } catch (err) {
      userError(err instanceof Error ? err.message : `Unusable number "${to}".`);
    }

    // Per-org hourly cap. Bounded read: `by_org_type` is exact, so this counts
    // manual sends only and cannot be diluted by a busy booking day.
    const since = Date.now() - MANUAL_WINDOW_MS;
    const recent = await ctx.db
      .query("outboundNotifications")
      .withIndex("by_org_type", (q) =>
        q.eq("orgId", orgId).eq("type", MANUAL_TYPE),
      )
      .order("desc") // every Convex index ends with _creationTime → newest first
      .take(MANUAL_HOURLY_LIMIT + 1);
    const inWindow = recent.filter((r) => r._creationTime >= since);
    if (inWindow.length >= MANUAL_HOURLY_LIMIT) {
      const oldest = inWindow[inWindow.length - 1]._creationTime;
      const minutes = Math.max(
        1,
        Math.ceil((oldest + MANUAL_WINDOW_MS - Date.now()) / 60_000),
      );
      userError(
        `That's ${MANUAL_HOURLY_LIMIT} manual messages in an hour, which is the limit. ` +
          `Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      );
    }

    // Render with the SAME renderer the queue uses, so what sends here and what
    // sends from a booking cannot drift apart.
    const filtered: TemplateVars = {};
    for (const name of TEMPLATE_VARIABLES) {
      const value = vars[name]?.trim();
      if (value) filtered[name] = value;
    }
    const rendered = renderNotification({
      type,
      channel: "sms",
      customBody: draft,
      vars: filtered,
    });

    // `renderNotification` falls back to the built-in template for `type` if it
    // decides the custom body is unusable. That is right for a queued booking
    // message — degrade to correct rather than to silence — but wrong here: the
    // admin is looking at a preview of their own wording, and quietly sending
    // the stock booking-confirmation text instead would be a lie. Refuse.
    if (rendered.source !== "custom") {
      userError("That message could not be rendered as written. Rephrase it.");
    }

    // A blank variable leaves its placeholder literal by design (see
    // `renderTemplate`). That is the right call for a queued message, where a
    // visible `{{guestName}}` beats a silent gap — but here a human is looking
    // at a preview and about to spend real credit, so refuse instead.
    if (rendered.missing.length > 0) {
      userError(
        `Fill in ${rendered.missing.map((m) => `{{${m}}}`).join(", ")} ` +
          "or remove them from the message.",
      );
    }

    const message = rendered.body.trim();
    if (!message) userError("That renders to an empty message.");

    const cost = smsSegments(message);
    if (cost.segments > MAX_SEGMENTS) {
      userError(
        `That's ${cost.segments} SMS segments (${cost.encoding}) and the limit is ${MAX_SEGMENTS}. ` +
          (cost.encoding === "UCS-2"
            ? "Non-GSM characters like curly quotes or emoji cut the limit from 160 to 70 per segment — replacing them usually fixes it."
            : "Shorten the message."),
      );
    }

    const id = await ctx.db.insert("outboundNotifications", {
      orgId,
      type: MANUAL_TYPE,
      channel: "sms",
      status: "queued",
      recipient,
      body: message,
    });

    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "notification.send_manual",
      entityType: "outboundNotification",
      entityId: id,
      // The message body is deliberately recorded: a manual send is the kind
      // that gets questioned later ("who told the guest that?"), and the audit
      // log is the only place that answer survives.
      after: { recipient, type, body: message, segments: cost.segments },
    });

    return { id, recipient, message };
  },
});

/**
 * Send one SMS now and report what the gateway said.
 *
 * Immediate rather than queued because a human is standing there watching: a
 * message you just typed taking up to five minutes to leave, with no feedback,
 * is indistinguishable from a broken button.
 */
export const sendNow = action({
  args: {
    to: v.string(),
    type: v.optional(v.string()),
    body: v.string(),
    vars: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (
    ctx,
    { to, type, body, vars },
  ): Promise<{
    ok: boolean;
    sentTo: string;
    senderId: string;
    message: string;
    error?: string;
  }> => {
    // Checked before `prepare` so a missing credential costs nothing and reads
    // as a setup problem, rather than leaving a queued row the admin did not
    // ask for and cannot explain.
    const sms = readHostPinnacleConfig(process.env);
    if (!sms) {
      userError(
        "SMS is not configured yet. Set HOSTPINNACLE_USER_ID and HOSTPINNACLE_PASSWORD " +
          "on the production deployment, then try again.",
      );
    }

    const prepared: Prepared = await ctx.runMutation(
      internal.manualMessages.prepare,
      { to, type: type ?? MANUAL_TYPE, body, vars: vars ?? {} },
    );

    let outcome: SendOutcome;
    try {
      const res = await fetch(sms.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildSendPayload(sms, [
            { mobile: prepared.recipient, msg: prepared.message },
          ]),
        ),
      });
      // HostPinnacle returns rejections as HTTP 200 with an error body, so the
      // body — not `res.ok` — decides whether this actually went out.
      outcome = interpretSendResponse(res.status, await res.text());
    } catch (err) {
      outcome = {
        ok: false,
        error: err instanceof Error ? err.message : "Send failed",
      };
    }

    // Reuses the engine's own transition logic, so a manual row ages exactly
    // like a queued one: below 3 attempts it stays `queued` and the cron will
    // retry it, which is why a failure here is reported as "not yet", not "no".
    await ctx.runMutation(internal.notificationsEngine.markResult, {
      id: prepared.id,
      ok: outcome.ok,
      error: outcome.error,
    });

    return {
      ok: outcome.ok,
      sentTo: prepared.recipient,
      senderId: sms.senderId,
      message: prepared.message,
      error: outcome.error,
    };
  },
});
