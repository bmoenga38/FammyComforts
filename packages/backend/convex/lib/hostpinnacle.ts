/**
 * Pure HostPinnacle SMS helpers. No IO here: everything is unit-testable
 * without HTTP. The action layer (`convex/notificationsEngine.ts` → `drain`)
 * does the fetches.
 *
 * Gateway contract (HostPinnacle JSON API):
 *
 *   POST https://smsportal.hostpinnacle.co.ke/SMSApi/send
 *   Content-Type: application/json
 *   {
 *     "userid": "ammyhopes", "password": "…", "senderid": "AMMY_HOPES",
 *     "msgType": "text", "duplicatecheck": "false", "sendMethod": "quick",
 *     "sms": [{ "mobile": ["254712345678"], "msg": "…" }]
 *   }
 *
 * Two properties of this gateway drive the design below:
 *
 *  1. Credentials travel in the request *body*, not an `Authorization` header.
 *     There is no bearer token — `userid` + `password` are the auth.
 *  2. Failures come back as **HTTP 200 with an error payload**. So `res.ok` is
 *     not a delivery signal on its own; the body has to be interpreted, or
 *     every rejection ("Invalid Credentials", "Sender ID not approved",
 *     "Insufficient balance") silently counts as a success and the queue's
 *     retry logic never fires. `interpretSendResponse` is that interpretation.
 */

/** Documented JSON endpoint. Overridable via `HOSTPINNACLE_API_URL`. */
export const HOSTPINNACLE_SEND_URL =
  "https://smsportal.hostpinnacle.co.ke/SMSApi/send";

/** The approved sender ID for this account. Not a secret. */
export const DEFAULT_SENDER_ID = "AMMY_HOPES";

export type HostPinnacleConfig = {
  /** Account username — lowercase, distinct from the sender ID. */
  userId: string;
  password: string;
  /** Approved alphanumeric sender ID, e.g. `AMMY_HOPES`. */
  senderId: string;
  apiUrl: string;
  duplicateCheck: boolean;
};

/**
 * Read platform-wide Convex env vars into a config, or `null` when the gateway
 * is not configured. `null` deliberately leaves SMS rows `queued` rather than
 * failing them — same "no fake sent, no fake failed" stance the engine already
 * takes for email/whatsapp.
 *
 * `HOSTPINNACLE_DUPLICATE_CHECK` defaults to **off**. HostPinnacle's
 * `duplicatecheck` suppresses an identical message to the same number inside a
 * provider-side window, which collides with this queue's 3-attempt retry: a
 * genuinely failed send would be silently dropped on retry and the guest would
 * never receive their booking confirmation. The queue's own `status`/`attempts`
 * bookkeeping is the authority on duplicates. Set it to `"true"` only if the
 * provider's window is understood and accepted.
 */
export function readHostPinnacleConfig(
  env: Record<string, string | undefined>,
): HostPinnacleConfig | null {
  const userId = env.HOSTPINNACLE_USER_ID?.trim();
  const password = env.HOSTPINNACLE_PASSWORD?.trim();
  // Both halves of the credential are required; a partial config is a
  // misconfiguration, not a usable gateway.
  if (!userId || !password) return null;
  return {
    userId,
    password,
    senderId: env.HOSTPINNACLE_SENDER_ID?.trim() || DEFAULT_SENDER_ID,
    apiUrl: env.HOSTPINNACLE_API_URL?.trim() || HOSTPINNACLE_SEND_URL,
    duplicateCheck:
      env.HOSTPINNACLE_DUPLICATE_CHECK?.trim().toLowerCase() === "true",
  };
}

/**
 * Normalize a Kenyan MSISDN to the `254…` form HostPinnacle expects.
 *
 * Deliberately *not* `lib/mpesa.ts`'s `normalizeMsisdn`: that one only accepts
 * `07…` because M-Pesa STK is Safaricom-only. SMS is network-agnostic, so this
 * also accepts the `01…` range (Airtel/Telkom) — otherwise every guest on an
 * `011…` number would be unreachable by SMS.
 */
export function normalizeSmsMsisdn(input: string): string {
  const raw = input.trim().replace(/[\s()-]/g, "");
  if (/^0[71]\d{8}$/.test(raw)) return `254${raw.slice(1)}`;
  if (/^\+254[71]\d{8}$/.test(raw)) return raw.slice(1);
  if (/^254[71]\d{8}$/.test(raw)) return raw;
  throw new Error(
    `Unroutable phone number "${input}" (expected 07XX XXX XXX or 01XX XXX XXX)`,
  );
}

export type SmsMessage = { mobile: string; msg: string };

export type HostPinnaclePayload = {
  userid: string;
  password: string;
  senderid: string;
  msgType: "text";
  duplicatecheck: "true" | "false";
  sendMethod: "quick";
  sms: { mobile: string[]; msg: string }[];
};

/**
 * Build the request body. The `sms` array supports batching, but the drain
 * sends one message per request: the queue marks delivery per row and drives
 * per-row retries, and this provider's batch response shape hasn't been
 * verified against a live send yet — attributing a batch result back to the
 * right rows would be guesswork, and guessing "sent" on a booking confirmation
 * is a silent failure. At 50 rows per 5-minute tick the extra requests are
 * free. Revisit once a real response body is on record.
 */
export function buildSendPayload(
  config: HostPinnacleConfig,
  messages: SmsMessage[],
): HostPinnaclePayload {
  if (messages.length === 0) throw new Error("No SMS messages to send.");
  return {
    userid: config.userId,
    password: config.password,
    senderid: config.senderId,
    msgType: "text",
    duplicatecheck: config.duplicateCheck ? "true" : "false",
    sendMethod: "quick",
    sms: messages.map(({ mobile, msg }) => ({
      mobile: [normalizeSmsMsisdn(mobile)],
      msg,
    })),
  };
}

/** Provider vocabulary for "we accepted this", lowercased. */
const SUCCESS_STATUSES = new Set([
  "success",
  "ok",
  "sent",
  "queued",
  "submitted",
]);

/** Keys HostPinnacle-style APIs use to explain a rejection. */
const REASON_KEYS = [
  "reason",
  "message",
  "description",
  "desc",
  "errorMessage",
  "error",
];

const MAX_ERROR_CHARS = 300;

/** Collapse to one line and cap length — this lands in a DB `error` field. */
function snippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_ERROR_CHARS
    ? `${flat.slice(0, MAX_ERROR_CHARS)}…`
    : flat;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(
  source: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** First per-message entry, whichever array key the provider used. */
function firstEntry(
  source: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!source) return null;
  for (const key of ["data", "sms", "results", "messages"]) {
    const value = source[key];
    if (Array.isArray(value) && value.length > 0) {
      const entry = asRecord(value[0]);
      if (entry) return entry;
    }
  }
  return null;
}

export type SendOutcome = { ok: boolean; error?: string };

/**
 * Decide whether HostPinnacle actually accepted the message.
 *
 * Conservative by design: anything not recognisably a success is reported as a
 * failure **with the raw body attached**. An unknown-but-fine response costs 3
 * retries and one `failed` row carrying the real payload — which is exactly the
 * evidence needed to tighten this function. The opposite bias (assume success)
 * loses guest messages invisibly.
 */
export function interpretSendResponse(
  httpStatus: number,
  bodyText: string,
): SendOutcome {
  const body = snippet(bodyText ?? "");
  if (httpStatus < 200 || httpStatus >= 300) {
    return {
      ok: false,
      error: `HostPinnacle HTTP ${httpStatus}${body ? `: ${body}` : ""}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      error: `Unrecognized HostPinnacle response: ${body || "(empty body)"}`,
    };
  }

  const root = asRecord(parsed);
  const entry = firstEntry(root);
  const rootStatus = firstString(root, ["status"]);
  const entryStatus = firstString(entry, ["status"]);
  const status = rootStatus ?? entryStatus;
  if (!status) {
    return {
      ok: false,
      error: `Unrecognized HostPinnacle response: ${body || "(empty body)"}`,
    };
  }

  const envelopeOk = SUCCESS_STATUSES.has(status.toLowerCase());
  // A batch can report success at the envelope while rejecting the one message
  // in it; the per-message status wins when the two disagree.
  const entryFailed =
    entryStatus !== null && !SUCCESS_STATUSES.has(entryStatus.toLowerCase());
  if (envelopeOk && !entryFailed) return { ok: true };

  const failing = entryFailed && entryStatus ? entryStatus : status;
  const reason =
    firstString(entry, REASON_KEYS) ?? firstString(root, REASON_KEYS);
  return {
    ok: false,
    error: `HostPinnacle rejected the message (${failing})${
      reason ? `: ${reason}` : ""
    }`,
  };
}
