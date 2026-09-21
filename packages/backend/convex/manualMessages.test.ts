import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import {
  MANUAL_HOURLY_LIMIT,
  MANUAL_TYPE,
  MAX_SEGMENTS,
} from "./manualMessages";

/**
 * Guards on the manual "send one SMS" path.
 *
 * Every test drives `prepare`, never `sendNow`. That is deliberate: `prepare`
 * holds all four guards (permission, phone, rate limit, message validity) and
 * `sendNow` is a thin wrapper around `fetch`. Testing `prepare` covers the
 * behaviour that matters with no network, and proves the property that actually
 * protects the SMS balance — a refused send cannot reach the gateway, because
 * the row the gateway call is built from is never created.
 *
 * So every rejection test also asserts the queue is still empty. A guard that
 * throws *after* inserting would still leave the cron a row to send, which is
 * the failure this feature most needs to not have.
 */

async function seedAdmin(t: ReturnType<typeof convexTest>, slug = "acme") {
  const ids = await t.mutation(internal.identity.upsertFromHandoff, {
    org: { bytebazaarOrgId: `bb_${slug}`, name: `Org ${slug}`, slug },
    user: {
      bytebazaarUserId: `bb_admin_${slug}`,
      name: "Owner",
      role: "org_admin",
    },
  });
  await t.mutation(internal.rbac.bootstrapForUser, {
    orgId: ids.orgId,
    userId: ids.userId,
    ssoRole: "org_admin",
  });
  return { ...ids, as: t.withIdentity({ subject: ids.userId }) };
}

type Seeded = Awaited<ReturnType<typeof seedAdmin>>;

/** A valid send, with any field overridable per test. */
function send(
  s: Seeded,
  args: Partial<{
    to: string;
    type: string;
    body: string;
    vars: Record<string, string>;
  }> = {},
) {
  return s.as.mutation(internal.manualMessages.prepare, {
    to: "0712345678",
    type: "booking_confirmation",
    body: "Karibu {{guestName}}, your room is ready.",
    vars: { guestName: "Janet" },
    ...args,
  });
}

const queue = (t: ReturnType<typeof convexTest>) =>
  t.run((ctx) => ctx.db.query("outboundNotifications").collect());

/**
 * The `data` an error carries. `ConvexError` puts the human sentence here and
 * that is the only part Convex delivers to the browser from a production
 * deployment — a plain `Error` has no `data`, so asserting on it is what proves
 * the message would actually arrive rather than being redacted.
 */
const errorData = (err: unknown): string =>
  String((err as { data?: unknown } | null)?.data ?? "");

describe("manualMessages.prepare", () => {
  it("queues one manual row with the rendered text and audits the body", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    const result = await send(s);

    // The number is normalized before anything is written, so the row carries
    // the form HostPinnacle expects rather than what was typed.
    expect(result.recipient).toBe("254712345678");
    expect(result.message).toBe("Karibu Janet, your room is ready.");

    const rows = await queue(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      // Not "booking_confirmation": the row is typed `manual` so the rate limit
      // counts it, even though a booking template supplied the wording.
      type: MANUAL_TYPE,
      channel: "sms",
      status: "queued",
      recipient: "254712345678",
      body: "Karibu Janet, your room is ready.",
    });

    const audits = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    const manual = audits.find((a) => a.action === "notification.send_manual");
    expect(manual).toBeTruthy();
    // The wording is recorded on purpose — a manual send is the kind that gets
    // questioned later, and this is the only place the answer survives.
    expect(manual!.after).toMatchObject({
      recipient: "254712345678",
      body: "Karibu Janet, your room is ready.",
    });
  });

  it("refuses a caller without Notifications:manage and queues nothing", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await seedAdmin(t);
    // In the org, but bootstrapped into no role — so no grants at all.
    const nobody = await t.mutation(internal.identity.upsertFromHandoff, {
      org: { bytebazaarOrgId: "bb_acme", name: "Org acme", slug: "acme" },
      user: { bytebazaarUserId: "bb_nobody", name: "Sam", role: "driver" },
    });

    await expect(
      t.withIdentity({ subject: nobody.userId }).mutation(
        internal.manualMessages.prepare,
        {
          to: "0712345678",
          type: "booking_confirmation",
          body: "Hi there.",
          vars: {},
        },
      ),
    ).rejects.toThrow(/permission|FORBIDDEN/i);

    expect(await queue(t)).toHaveLength(0);
  });

  it("refuses an unroutable number as a ConvexError, so the reason survives production", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    // `normalizeSmsMsisdn` throws a plain Error, which Convex REDACTS on a prod
    // deployment — the admin would see "Server Error <id>" and have no idea the
    // number was the problem. `prepare` re-throws it via `userError`. Asserting
    // only the message would not catch a regression here, because convex-test
    // does not redact; assert on `data`, which only a ConvexError carries.
    const err = await send(s, { to: "0812345678" }).catch((e: unknown) => e);
    expect(errorData(err)).toMatch(/Unroutable/);

    expect(await queue(t)).toHaveLength(0);
  });

  it("names an unknown placeholder instead of charging for a literal one", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    await expect(
      send(s, { body: "Hi {{guestname}}, welcome.", vars: {} }),
    ).rejects.toThrow(/Unknown placeholder.*guestname/s);

    expect(await queue(t)).toHaveLength(0);
  });

  it("refuses while a known placeholder is still unfilled", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    // The renderer deliberately leaves an unfilled variable as its literal, which
    // is right for a queued message (a visible {{guestName}} beats a silent gap).
    // Here a human is watching a preview and about to spend credit, so refusing
    // is right instead — no guest should ever receive "Karibu {{guestName}}".
    await expect(send(s, { vars: {} })).rejects.toThrow(/Fill in.*guestName/s);

    expect(await queue(t)).toHaveLength(0);
  });

  it("accepts {{ spaced }} placeholders, matching the renderer's own regex", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    const result = await send(s, {
      body: "Karibu {{ guestName }}, your room is ready.",
    });
    expect(result.message).toBe("Karibu Janet, your room is ready.");
  });

  it("refuses a message over the segment cap", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    // GSM-7 bills 153 characters per segment once a message is multipart, so
    // 700 plain characters is 5 segments — one over the cap.
    await expect(
      send(s, { body: "A".repeat(700), vars: {} }),
    ).rejects.toThrow(new RegExp(`5 SMS segments \\(GSM-7\\).*${MAX_SEGMENTS}`, "s"));

    expect(await queue(t)).toHaveLength(0);
  });

  it("explains the emoji trap when a short message is over the cap", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    // 150 emoji is 300 UTF-16 units — under half the plain-text length above, yet
    // over the cap, because one non-GSM character drops the whole message to
    // UCS-2 at 67 units per segment. The error has to say so, or the admin just
    // sees "too long" on a message that looks short.
    const err = await send(s, { body: "🙂".repeat(150), vars: {} }).catch(
      (e: unknown) => e,
    );
    expect(errorData(err)).toMatch(/UCS-2/);
    expect(errorData(err)).toMatch(/emoji/);

    expect(await queue(t)).toHaveLength(0);
  });

  it("stops at the hourly limit and says how long to wait", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    for (let i = 0; i < MANUAL_HOURLY_LIMIT; i++) await send(s);
    expect(await queue(t)).toHaveLength(MANUAL_HOURLY_LIMIT);

    await expect(send(s)).rejects.toThrow(/limit.*minute/s);
    // The refusal must not itself queue a row, or the cap would leak by one per
    // attempt and an attacker could spend the balance by hammering a blocked
    // button.
    expect(await queue(t)).toHaveLength(MANUAL_HOURLY_LIMIT);
  });

  it("applies the limit per org, not globally", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const a = await seedAdmin(t, "acme");
    const b = await seedAdmin(t, "beta");

    for (let i = 0; i < MANUAL_HOURLY_LIMIT; i++) await send(a);
    await expect(send(a)).rejects.toThrow(/limit/);

    // One busy property must never mute another one.
    await expect(send(b)).resolves.toMatchObject({
      recipient: "254712345678",
    });
  });

  it("does not let booking traffic eat the manual budget", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const s = await seedAdmin(t);

    // Why this matters: if the count read the org's recent notifications of
    // *every* type and filtered in JS, a day of bookings would push the manual
    // rows out of the bounded read and the limit would silently stop applying.
    // The `by_org_type` index makes the count exact, and this proves it.
    await t.run(async (ctx) => {
      for (let i = 0; i < MANUAL_HOURLY_LIMIT * 2; i++) {
        await ctx.db.insert("outboundNotifications", {
          orgId: s.orgId,
          type: "booking_confirmation",
          channel: "sms",
          status: "queued",
          recipient: "254700000001",
          body: "Karibu Ada, your booking is confirmed.",
        });
      }
    });

    await expect(send(s)).resolves.toMatchObject({
      message: "Karibu Janet, your room is ready.",
    });
  });
});
