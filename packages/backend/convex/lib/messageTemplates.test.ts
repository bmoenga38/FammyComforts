// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  TEMPLATE_VARIABLES,
  sanitizeVar,
  guestFirstName,
  unknownPlaceholders,
  renderTemplate,
  defaultTemplate,
  templatedTypes,
  renderNotification,
  smsSegments,
} from "./messageTemplates";

/** Representative booking values, as `guestBookings.create` supplies them. */
const VARS = {
  guestName: "Janet",
  propertyName: "Fammy Comforts",
  reference: "BK-U2FDA9",
  roomNumber: "202",
  checkIn: "2026-06-16",
  checkOut: "2026-06-18",
  nights: 2,
  amount: "KES 33,640",
};

describe("sanitizeVar", () => {
  it("strips control characters, zero-width marks and bidi overrides", () => {
    // A newline would break the provider's JSON body; the rest are invisible
    // and exist mainly to disguise text.
    expect(sanitizeVar("Ja\u0000n\u001Bet")).toBe("Janet");
    expect(sanitizeVar("Ja\u200Bnet\uFEFF")).toBe("Janet");
    expect(sanitizeVar("\u202EJanet\u202C")).toBe("Janet");
    expect(sanitizeVar("Ja\u00ADnet")).toBe("Janet");
  });

  it("collapses whitespace and trims, so a name cannot pad a message", () => {
    expect(sanitizeVar("  Janet   Wanjiku \n Kamau ")).toBe("Janet Wanjiku Kamau");
    expect(sanitizeVar("Room\t202")).toBe("Room 202");
  });

  it("caps length and coerces numbers and int64 money", () => {
    expect(sanitizeVar("x".repeat(500), 10)).toBe("xxxxxxxxxx");
    expect(sanitizeVar(2)).toBe("2");
    expect(sanitizeVar(1218000n)).toBe("1218000");
    expect(sanitizeVar(null)).toBe("");
    expect(sanitizeVar(undefined)).toBe("");
  });

  it("never leaves trailing space after truncation", () => {
    expect(sanitizeVar("Janet Wanjiku", 6)).toBe("Janet");
  });
});

describe("guestFirstName", () => {
  it("takes only the first token, bounding guest-controlled text", () => {
    expect(guestFirstName("Janet Wanjiku Kamau")).toBe("Janet");
    expect(guestFirstName("  ada   guest ")).toBe("ada");
  });

  it("falls back rather than greeting nobody", () => {
    expect(guestFirstName("")).toBe("Guest");
    expect(guestFirstName("   ")).toBe("Guest");
    expect(guestFirstName("\u200B\u200B")).toBe("Guest");
    expect(guestFirstName("", "Rafiki")).toBe("Rafiki");
  });
});

describe("unknownPlaceholders", () => {
  it("accepts every documented variable", () => {
    const all = TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(" ");
    expect(unknownPlaceholders(all)).toEqual([]);
  });

  it("reports typos, deduplicated and sorted", () => {
    expect(unknownPlaceholders("Hi {{guestname}}, ref {{ref}} {{ref}}")).toEqual([
      "guestname",
      "ref",
    ]);
  });

  it("ignores text that merely resembles a placeholder", () => {
    expect(unknownPlaceholders("Total {{amount}} (not { {amount} })")).toEqual([]);
  });
});

describe("renderTemplate", () => {
  it("substitutes known variables, tolerating inner whitespace", () => {
    const { text, missing } = renderTemplate(
      "Booking {{reference}} for {{ guestName }} — {{nights}} nights, {{amount}}.",
      VARS,
    );
    expect(text).toBe("Booking BK-U2FDA9 for Janet — 2 nights, KES 33,640.");
    expect(missing).toEqual([]);
  });

  it("leaves a placeholder literal when the value is absent, and reports it", () => {
    // Loud beats silent: "Hi , your booking" reads as a product bug the customer
    // sees, whereas the literal shows up in the queue row and in review.
    const { text, missing } = renderTemplate("Hi {{guestName}}, ref {{reference}}.", {
      reference: "BK-U2FDA9",
    });
    expect(text).toBe("Hi {{guestName}}, ref BK-U2FDA9.");
    expect(missing).toEqual(["guestName"]);
  });

  it("treats an empty string as missing", () => {
    expect(renderTemplate("Hi {{guestName}}", { guestName: "" }).missing).toEqual([
      "guestName",
    ]);
  });

  it("does not re-interpolate a value that looks like a placeholder", () => {
    // The single-pass guarantee: a guest named "{{amount}}" gets their odd name
    // back, not the booking total.
    const { text } = renderTemplate("Hi {{guestName}}, total {{amount}}.", {
      ...VARS,
      guestName: "{{amount}}",
    });
    expect(text).toBe("Hi {{amount}}, total KES 33,640.");
  });

  it("strips a newline injected through a variable", () => {
    const { text } = renderTemplate("Alert: {{message}}", {
      message: "line one\nSTOP to unsubscribe",
    });
    expect(text).toBe("Alert: line one STOP to unsubscribe");
    expect(text).not.toContain("\n");
  });

  it("enforces the per-variable cap so a long name cannot crowd out the content", () => {
    const { text } = renderTemplate("Hi {{guestName}}, total {{amount}}.", {
      ...VARS,
      guestName: "A".repeat(400),
    });
    expect(text).toContain("total KES 33,640.");
    expect(text.length).toBeLessThan(70);
  });
});

describe("defaultTemplate", () => {
  it("covers every type it claims to", () => {
    expect(templatedTypes()).toEqual([
      "booking_confirmation",
      "check_in_reminder",
      "check_out_reminder",
      "payment_receipt",
      "staff_alert",
      "task_assignment",
    ]);
    for (const type of templatedTypes()) {
      expect(defaultTemplate(type, "sms")?.body).toBeTruthy();
    }
  });

  it("returns null for an unknown type", () => {
    expect(defaultTemplate("nope", "sms")).toBeNull();
  });

  it("reuses the SMS text for whatsapp and push, and gives email a subject", () => {
    const sms = defaultTemplate("booking_confirmation", "sms");
    expect(defaultTemplate("booking_confirmation", "whatsapp")).toEqual(sms);
    expect(defaultTemplate("booking_confirmation", "push")).toEqual(sms);
    expect(defaultTemplate("booking_confirmation", "email")?.subject).toContain(
      "{{reference}}",
    );
  });

  it("only references variables the renderer can fill", () => {
    // Guards the defaults against the same typo saveTemplate rejects for admins.
    for (const type of templatedTypes()) {
      for (const channel of ["sms", "email"] as const) {
        const t = defaultTemplate(type, channel);
        expect(unknownPlaceholders(`${t?.body} ${t?.subject ?? ""}`)).toEqual([]);
      }
    }
  });
});

describe("renderNotification", () => {
  it("renders the built-in booking confirmation with real values", () => {
    const r = renderNotification({
      type: "booking_confirmation",
      channel: "sms",
      vars: VARS,
    });
    expect(r.source).toBe("default");
    expect(r.missing).toEqual([]);
    expect(r.body).toBe(
      "Hi Janet, your booking BK-U2FDA9 at Fammy Comforts is confirmed. " +
        "Room 202, 2026-06-16 to 2026-06-18 (2 nights). Total KES 33,640. Karibu!",
    );
    // The regression this whole change exists to prevent.
    expect(r.body).not.toBe("booking confirmation");
  });

  it("prefers a valid custom template", () => {
    const r = renderNotification({
      type: "booking_confirmation",
      channel: "sms",
      customBody: "{{propertyName}}: {{reference}} confirmed. Karibu!",
      vars: VARS,
    });
    expect(r.source).toBe("custom");
    expect(r.body).toBe("Fammy Comforts: BK-U2FDA9 confirmed. Karibu!");
  });

  it("falls back to the default when a custom template has a bad placeholder", () => {
    // Degrade to a correct message, never to silence — the org is billed for the
    // send either way.
    const r = renderNotification({
      type: "booking_confirmation",
      channel: "sms",
      customBody: "Hi {{guestname}}, ref {{reference}}",
      vars: VARS,
    });
    expect(r.source).toBe("default");
    expect(r.body).toContain("Hi Janet");
  });

  it("ignores a blank or whitespace-only custom template", () => {
    for (const customBody of ["", "   ", null, undefined]) {
      expect(
        renderNotification({
          type: "booking_confirmation",
          channel: "sms",
          customBody,
          vars: VARS,
        }).source,
      ).toBe("default");
    }
  });

  it("keeps a subject for email only", () => {
    const email = renderNotification({
      type: "booking_confirmation",
      channel: "email",
      vars: VARS,
    });
    expect(email.subject).toBe("Booking BK-U2FDA9 confirmed — Fammy Comforts");
    expect(
      renderNotification({ type: "booking_confirmation", channel: "sms", vars: VARS })
        .subject,
    ).toBeUndefined();
  });

  it("still says something readable for a type with no default", () => {
    const r = renderNotification({
      type: "fridge_offline",
      channel: "sms",
      vars: { propertyName: "Fammy Comforts", message: "Bar fridge is warm", reference: "BK-1" },
    });
    expect(r.source).toBe("generic");
    expect(r.body).toBe("Fammy Comforts: fridge offline - Bar fridge is warm Ref BK-1");
    // Hyphen, not an em dash: one non-GSM-7 character retunes the whole message
    // to UCS-2 and cuts the per-segment budget from 160 characters to 70.
    expect(smsSegments(r.body).encoding).toBe("GSM-7");
  });

  it("never returns an empty body, whatever it is handed", () => {
    for (const input of [
      { type: "booking_confirmation", channel: "sms" as const, vars: {} },
      { type: "", channel: "sms" as const, vars: {} },
      { type: "unknown_thing", channel: "push" as const, vars: {} },
    ]) {
      expect(renderNotification(input).body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("smsSegments", () => {
  it("bills the default booking confirmation as a single segment", () => {
    const { body } = renderNotification({
      type: "booking_confirmation",
      channel: "sms",
      vars: VARS,
    });
    const cost = smsSegments(body);
    expect(cost.encoding).toBe("GSM-7");
    expect(cost.segments).toBe(1);
  });

  it("counts GSM-7 boundaries exactly", () => {
    expect(smsSegments("")).toEqual({ encoding: "GSM-7", units: 0, segments: 0 });
    expect(smsSegments("a".repeat(160)).segments).toBe(1);
    // Past 160 every part loses 7 septets to the concatenation header.
    expect(smsSegments("a".repeat(161)).segments).toBe(2);
    expect(smsSegments("a".repeat(306)).segments).toBe(2);
    expect(smsSegments("a".repeat(307)).segments).toBe(3);
  });

  it("charges extended GSM-7 characters double", () => {
    expect(smsSegments("[]{}").units).toBe(8);
    expect(smsSegments("€").units).toBe(2);
  });

  it("drops to UCS-2 on one non-GSM character, collapsing capacity", () => {
    // The trap: a curly apostrophe pasted from Word retunes the whole message.
    const curly = smsSegments("we’ve received your payment");
    expect(curly.encoding).toBe("UCS-2");
    expect(smsSegments("a".repeat(70) + "’").segments).toBe(2);
    expect(smsSegments("’".repeat(70)).segments).toBe(1);
  });

  it("counts an emoji as two UCS-2 units", () => {
    expect(smsSegments("\u{1F600}").units).toBe(2);
  });

  it("confirms the plain ASCII default stays on the cheap encoding", () => {
    for (const type of templatedTypes()) {
      const body = defaultTemplate(type, "sms")!.body;
      expect(smsSegments(body).encoding).toBe("GSM-7");
    }
  });
});
