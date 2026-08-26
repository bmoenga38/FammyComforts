import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgUser, requirePermission } from "./lib/auth";
import {
  TEMPLATE_VARIABLES,
  unknownPlaceholders,
  defaultTemplate,
  renderNotification,
  smsSegments,
} from "./lib/messageTemplates";
import { userError } from "./lib/errors";

/**
 * Notification settings (Story 3.5) — per-org, "Notifications" area. One row per
 * (type, channel); the notification engine (later epics) respects `enabled`.
 * Reads need an authenticated org user; `setEnabled` needs `Notifications:manage`.
 */
const CHANNEL = v.union(
  v.literal("email"),
  v.literal("sms"),
  v.literal("whatsapp"),
  v.literal("push"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("notificationSettings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

/** Enable/disable one (type, channel). Upserts the row; audited. */
export const setEnabled = mutation({
  args: { type: v.string(), channel: CHANNEL, enabled: v.boolean() },
  handler: async (ctx, { type, channel, enabled }) => {
    const { user, orgId } = await requirePermission(
      ctx,
      "Notifications",
      "manage",
    );
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_org_type_channel", (q) =>
        q.eq("orgId", orgId).eq("type", type).eq("channel", channel),
      )
      .unique();

    if (existing) {
      if (existing.enabled === enabled) return { changed: false };
      await ctx.db.patch(existing._id, { enabled });
    } else {
      await ctx.db.insert("notificationSettings", {
        orgId,
        type,
        channel,
        enabled,
      });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "notification.set_enabled",
      entityType: "notificationSetting",
      after: { type, channel, enabled },
    });
    return { changed: true };
  },
});

/** All saved message templates for the org (type/channel → body). */
export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgUser(ctx);
    return await ctx.db
      .query("notificationTemplates")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

/** Upsert the message body/subject for one (type, channel). Notifications:manage. */
export const saveTemplate = mutation({
  args: {
    type: v.string(),
    channel: CHANNEL,
    body: v.string(),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, { type, channel, body, subject }) => {
    const { user, orgId } = await requirePermission(ctx, "Notifications", "manage");
    if (!body.trim()) userError("Message body can't be empty.");
    // Reject a placeholder the renderer cannot fill, here at the editable
    // boundary. Otherwise the typo survives to send time, where the only options
    // are to charge for a message reading "Hi {{guestname}}" or to silently drop
    // the admin's wording — both discovered by a guest rather than by the admin.
    const unknown = unknownPlaceholders(body + " " + (subject ?? ""));
    if (unknown.length > 0) {
      userError(
        `Unknown placeholder${unknown.length > 1 ? "s" : ""} ` +
          `${unknown.map((u) => `{{${u}}}`).join(", ")}. ` +
          `Available: ${TEMPLATE_VARIABLES.map((t) => `{{${t}}}`).join(", ")}.`,
      );
    }
    const existing = await ctx.db
      .query("notificationTemplates")
      .withIndex("by_org_type_channel", (q) =>
        q.eq("orgId", orgId).eq("type", type).eq("channel", channel),
      )
      .unique();
    const patch = {
      body: body.trim(),
      subject: channel === "email" ? subject?.trim() || undefined : undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("notificationTemplates", { orgId, type, channel, ...patch });
    }
    await ctx.db.insert("auditLogs", {
      orgId,
      actorId: user._id,
      action: "notification.save_template",
      entityType: "notificationTemplate",
      after: { type, channel },
    });
    return { saved: true };
  },
});

/**
 * Render a template with sample values, using the SAME renderer the queue uses,
 * plus the real SMS segment cost.
 *
 * The editor previously previewed with its own copy of the substitution logic and
 * its own copy of the default bodies, which could drift from what actually sends.
 * Asking the server means the preview is the truth by construction. Pass an
 * unsaved `body` to preview a draft; omit it to preview what is saved (or the
 * built-in default when nothing is saved).
 */
export const previewTemplate = query({
  args: { type: v.string(), channel: CHANNEL, body: v.optional(v.string()) },
  handler: async (ctx, { type, channel, body }) => {
    const { orgId } = await requireOrgUser(ctx);
    const org = await ctx.db.get(orgId);

    const draft = body?.trim();
    const unknown = draft ? unknownPlaceholders(draft) : [];
    const saved = draft
      ? null
      : await ctx.db
          .query("notificationTemplates")
          .withIndex("by_org_type_channel", (q) =>
            q.eq("orgId", orgId).eq("type", type).eq("channel", channel),
          )
          .unique();

    // Representative, obviously-fake values — never a real guest's details.
    const rendered = renderNotification({
      type,
      channel,
      customBody: draft ?? saved?.body,
      customSubject: saved?.subject,
      vars: {
        guestName: "Janet",
        propertyName: org?.name ?? "Your property",
        reference: "BK-U2FDA9",
        roomNumber: "202",
        checkIn: "2026-06-16",
        checkOut: "2026-06-18",
        nights: 2,
        amount: "KES 33,640",
        message: "Room 202 needs attention",
      },
    });

    return {
      body: rendered.body,
      subject: rendered.subject,
      source: rendered.source,
      // Placeholders the renderer knows but had no sample for — a template
      // referencing {{message}} on a booking type, for instance.
      missing: rendered.missing,
      unknownPlaceholders: unknown,
      builtInDefault: defaultTemplate(type, channel)?.body ?? null,
      availableVariables: [...TEMPLATE_VARIABLES],
      sms: channel === "sms" || channel === "whatsapp" ? smsSegments(rendered.body) : null,
    };
  },
});
