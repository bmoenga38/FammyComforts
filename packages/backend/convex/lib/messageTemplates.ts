/**
 * Notification message rendering (Story 3.5 template editor → Story 10.6 engine).
 *
 * Pure and IO-free, like the rest of `lib/`: no `ctx`, no `fetch`, no clock. The
 * caller loads the org's `notificationTemplates` row (if any), calls
 * `renderNotification`, and stores the result as the `outboundNotifications.body`.
 *
 * Rendering happens at QUEUE time, not send time, so the exact text a guest was
 * promised is preserved on the row forever. If a template is later edited, past
 * notifications still read as they were sent — which is the whole point when a
 * guest disputes a quoted total.
 *
 * Two deliberate safety properties:
 *
 *  1. **Single-pass substitution.** Values are injected by one `replace` pass
 *     over the template and the output is never re-scanned, so a guest who names
 *     themselves `{{amount}}` cannot cause a second round of interpolation.
 *  2. **Values are sanitized, output is not truncated.** Control characters,
 *     zero-width characters and bidi overrides are stripped and each variable is
 *     length-capped, which bounds the final message without ever cutting a
 *     sentence in half. Guest-supplied text reaches real handsets under the
 *     approved `AMMY_HOPES` sender ID, so it is treated as hostile input.
 *
 * Placeholder names are the ones the admin editor in
 * `apps/web/src/app/(app)/admin/setup/page.tsx` already previews — do not rename
 * them without updating that file, or the preview will stop matching what sends.
 */

export type NotificationChannel = "email" | "sms" | "whatsapp" | "push";

/** Values a template may reference. Anything else is rejected at save time. */
export const TEMPLATE_VARIABLES = [
  "guestName",
  "propertyName",
  "reference",
  "roomNumber",
  "checkIn",
  "checkOut",
  "nights",
  "amount",
  "message",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateVars = Partial<
  Record<TemplateVariable, string | number | bigint | null | undefined>
>;

const KNOWN_VARIABLES: ReadonlySet<string> = new Set(TEMPLATE_VARIABLES);

/**
 * Per-variable length caps. Capping the INPUTS keeps the rendered message
 * bounded and predictable without truncating the sentence, so a guest cannot
 * push the real content out of an SMS by supplying a 400-character name.
 */
const VAR_MAX_CHARS: Record<TemplateVariable, number> = {
  guestName: 24,
  propertyName: 32,
  reference: 16,
  roomNumber: 10,
  checkIn: 12,
  checkOut: 12,
  nights: 4,
  amount: 16,
  message: 120,
};

/** `{{name}}`, tolerating inner whitespace (`{{ name }}`) as the editor might. */
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Characters that must never survive into a message, split by what should happen
 * to them.
 *
 * `INVISIBLE` is deleted outright: C0/C1 controls, DEL, soft hyphen, zero-width
 * characters, the BOM, and the directional-formatting characters. The bidi
 * overrides (U+202A-202E, U+2066-2069) are the interesting ones - they let text
 * render right-to-left and are a classic way to disguise a payload inside an
 * innocuous-looking string.
 *
 * `LINE_BREAKS` becomes a space instead. Deleting them would fuse the words on
 * either side ("Room\t202" -> "Room202"), which corrupts real data; a raw
 * newline still has to go, because it travels inside the provider JSON body.
 */
const INVISIBLE =
  // C0 except the whitespace controls, DEL, C1 except NEL, soft hyphen,
  // zero-width + bidi marks, RTL/LTR overrides and isolates, BOM.
  /[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const LINE_BREAKS = /[\t\n\v\f\r\u0085\u2028\u2029]/g;

/**
 * Make one interpolated value safe and bounded: drop invisibles, turn line breaks
 * into spaces, collapse whitespace runs, trim, then hard-cap the length.
 */
export function sanitizeVar(
  raw: string | number | bigint | null | undefined,
  maxChars = 60,
): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(INVISIBLE, "")
    .replace(LINE_BREAKS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, maxChars))
    .trim();
}

/**
 * First name only, for greetings. Shorter messages, and it narrows the phishing
 * surface: only the first token of a guest-controlled name ever reaches a
 * handset. Falls back when the name is empty or was entirely invisible
 * characters, so a message never greets nobody.
 */
export function guestFirstName(fullName: string, fallback = "Guest"): string {
  const first = sanitizeVar(fullName, VAR_MAX_CHARS.guestName).split(" ")[0];
  return first || fallback;
}

/**
 * Placeholders a template references that this renderer cannot fill. Used by
 * `notifications.saveTemplate` to reject a typo while the admin is still looking
 * at the editor, rather than discovering it in a guest's inbox.
 */
export function unknownPlaceholders(template: string): string[] {
  const bad = new Set<string>();
  for (const [, name] of template.matchAll(PLACEHOLDER)) {
    if (!KNOWN_VARIABLES.has(name)) bad.add(name);
  }
  return [...bad].sort();
}

/**
 * Substitute `{{placeholders}}` in one pass.
 *
 * A known variable with no supplied value is left as its literal placeholder and
 * reported in `missing`. That is intentional: `Hi , your booking is confirmed`
 * hides a bug, whereas `Hi {{guestName}}` makes it obvious in the queue row and
 * in review. Callers that cannot tolerate a literal should check `missing`.
 */
export function renderTemplate(
  template: string,
  vars: TemplateVars,
): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(PLACEHOLDER, (literal, name: string) => {
    if (!KNOWN_VARIABLES.has(name)) {
      missing.add(name);
      return literal;
    }
    const value = vars[name as TemplateVariable];
    if (value === null || value === undefined || value === "") {
      missing.add(name);
      return literal;
    }
    return sanitizeVar(value, VAR_MAX_CHARS[name as TemplateVariable]);
  });
  // Collapse whitespace introduced by the template itself, but keep the text.
  return { text: text.replace(/[ \t]+/g, " ").trim(), missing: [...missing].sort() };
}

type TemplateDefault = { body: string; subject?: string };

/**
 * Built-in defaults, used when the org has saved no template for a
 * (type, channel). Wording follows the property's existing voice ("Karibu",
 * "Asante"). `sms` doubles as the WhatsApp and in-app text; `email` overrides it
 * where a subject line is wanted.
 *
 * Kept short on purpose: an SMS is 160 GSM-7 characters per segment and each
 * extra segment is billed separately. `smsSegments()` measures the real cost —
 * the booking confirmation lands around 140 characters with typical values and
 * only crosses into a second segment when both the guest and property names run
 * near their caps.
 */
const DEFAULTS: Record<string, { sms: TemplateDefault; email?: TemplateDefault }> = {
  booking_confirmation: {
    sms: {
      body:
        "Hi {{guestName}}, your booking {{reference}} at {{propertyName}} is " +
        "confirmed. Room {{roomNumber}}, {{checkIn}} to {{checkOut}} " +
        "({{nights}} nights). Total {{amount}}. Karibu!",
    },
    email: {
      subject: "Booking {{reference}} confirmed — {{propertyName}}",
      body:
        "Hi {{guestName}},\n\nYour booking {{reference}} at {{propertyName}} is " +
        "confirmed.\n\nRoom: {{roomNumber}}\nCheck-in: {{checkIn}}\n" +
        "Check-out: {{checkOut}} ({{nights}} nights)\nTotal: {{amount}}\n\n" +
        "Karibu! We look forward to hosting you.",
    },
  },
  check_in_reminder: {
    sms: {
      body:
        "Hi {{guestName}}, reminder: check-in for {{reference}} at " +
        "{{propertyName}} is {{checkIn}}, room {{roomNumber}}. See you soon!",
    },
  },
  check_out_reminder: {
    sms: {
      body:
        "Hi {{guestName}}, check-out for {{reference}} is on {{checkOut}}. " +
        "We hope you enjoyed your stay at {{propertyName}}!",
    },
  },
  payment_receipt: {
    sms: {
      body:
        "Hi {{guestName}}, we have received {{amount}} for {{reference}} at " +
        "{{propertyName}}. Asante for your payment!",
    },
  },
  staff_alert: {
    sms: { body: "{{propertyName}} alert: {{message}}" },
  },
  task_assignment: {
    sms: { body: "{{propertyName}}: new task assigned - {{message}}" },
  },
};

/** The built-in template for a (type, channel), or null for an unknown type. */
export function defaultTemplate(
  type: string,
  channel: NotificationChannel,
): TemplateDefault | null {
  const entry = DEFAULTS[type];
  if (!entry) return null;
  // email has its own longer form where defined; whatsapp/push reuse the SMS text.
  return channel === "email" ? (entry.email ?? entry.sms) : entry.sms;
}

/** Notification types with a built-in default, for the admin editor and tests. */
export function templatedTypes(): string[] {
  return Object.keys(DEFAULTS).sort();
}

export type RenderedNotification = {
  body: string;
  subject?: string;
  /** Which template won, useful when auditing why a message read as it did. */
  source: "custom" | "default" | "generic";
  missing: string[];
};

/**
 * Resolve and render the message for one queued notification.
 *
 * Precedence: the org's saved template, then the built-in default, then a
 * generic last resort. The custom template is skipped if it references a
 * placeholder this renderer cannot fill or renders to nothing — a broken
 * template should degrade to a correct message, never to silence, because the
 * caller is about to charge the org for an SMS either way.
 */
export function renderNotification(input: {
  type: string;
  channel: NotificationChannel;
  customBody?: string | null;
  customSubject?: string | null;
  vars: TemplateVars;
}): RenderedNotification {
  const { type, channel, customBody, customSubject, vars } = input;

  const custom = customBody?.trim();
  if (custom && unknownPlaceholders(custom).length === 0) {
    const rendered = renderTemplate(custom, vars);
    if (rendered.text) {
      const subject = customSubject?.trim()
        ? renderTemplate(customSubject, vars).text
        : undefined;
      return {
        body: rendered.text,
        subject: channel === "email" ? subject : undefined,
        source: "custom",
        missing: rendered.missing,
      };
    }
  }

  const fallback = defaultTemplate(type, channel);
  if (fallback) {
    const rendered = renderTemplate(fallback.body, vars);
    const subject = fallback.subject
      ? renderTemplate(fallback.subject, vars).text
      : undefined;
    return {
      body: rendered.text,
      subject: channel === "email" ? subject : undefined,
      source: "default",
      missing: rendered.missing,
    };
  }

  // Unknown type: say something true and readable rather than nothing at all.
  const label = sanitizeVar(type.replaceAll("_", " "), 40) || "notification";
  const parts = [sanitizeVar(vars.propertyName, VAR_MAX_CHARS.propertyName)]
    .filter(Boolean)
    .concat(label);
  const detail = sanitizeVar(vars.message, VAR_MAX_CHARS.message);
  const reference = sanitizeVar(vars.reference, VAR_MAX_CHARS.reference);
  const tail = [detail, reference && `Ref ${reference}`].filter(Boolean).join(" ");
  return {
    body: `${parts.join(": ")}${tail ? ` - ${tail}` : ""}`.trim(),
    subject: undefined,
    source: "generic",
    missing: [],
  };
}

// ---------------------------------------------------------------------------
// SMS cost measurement
// ---------------------------------------------------------------------------

// GSM 03.38 default alphabet: one septet each.
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
// Reachable only via an escape byte, so these cost two septets each.
const GSM7_EXTENDED = "\f^{}\\[~]|€";

/**
 * How many SMS segments a message will be billed as.
 *
 * A single GSM-7 message fits 160 septets; once it splits, each part loses 7
 * septets to the concatenation header, leaving 153. Any character outside the
 * GSM-7 alphabet — a curly quote or an emoji pasted into a template, most
 * often — forces the whole message to UCS-2, which collapses capacity to 70
 * characters (67 when concatenated). That is why an innocuous-looking edit can
 * triple the send cost, and why the editor should surface this number.
 */
export function smsSegments(text: string): {
  encoding: "GSM-7" | "UCS-2";
  units: number;
  segments: number;
} {
  let units = 0;
  let gsm7 = true;
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) {
      units += 1;
    } else if (GSM7_EXTENDED.includes(ch)) {
      units += 2;
    } else {
      gsm7 = false;
      break;
    }
  }
  if (!gsm7) {
    // UCS-2 is billed per UTF-16 code unit, so astral characters count twice.
    units = 0;
    for (const ch of text) units += ch.length;
    return {
      encoding: "UCS-2",
      units,
      segments: units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67),
    };
  }
  return {
    encoding: "GSM-7",
    units,
    segments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153),
  };
}
