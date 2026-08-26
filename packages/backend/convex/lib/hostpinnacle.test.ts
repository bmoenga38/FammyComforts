// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEFAULT_SENDER_ID,
  HOSTPINNACLE_SEND_URL,
  readHostPinnacleConfig,
  normalizeSmsMsisdn,
  buildSendPayload,
  interpretSendResponse,
  type HostPinnacleConfig,
} from "./hostpinnacle";

const CONFIG: HostPinnacleConfig = {
  userId: "ammyhopes",
  password: "secret",
  senderId: DEFAULT_SENDER_ID,
  apiUrl: HOSTPINNACLE_SEND_URL,
  duplicateCheck: false,
};

describe("readHostPinnacleConfig", () => {
  it("returns null unless both halves of the credential are present", () => {
    expect(readHostPinnacleConfig({})).toBeNull();
    expect(readHostPinnacleConfig({ HOSTPINNACLE_USER_ID: "ammyhopes" })).toBeNull();
    expect(readHostPinnacleConfig({ HOSTPINNACLE_PASSWORD: "secret" })).toBeNull();
    // Blank-but-set counts as unset.
    expect(
      readHostPinnacleConfig({
        HOSTPINNACLE_USER_ID: "  ",
        HOSTPINNACLE_PASSWORD: "secret",
      }),
    ).toBeNull();
  });

  it("defaults the sender ID and endpoint so only the secrets must be set", () => {
    const config = readHostPinnacleConfig({
      HOSTPINNACLE_USER_ID: "ammyhopes",
      HOSTPINNACLE_PASSWORD: "secret",
    });
    expect(config).toEqual({
      userId: "ammyhopes",
      password: "secret",
      senderId: "AMMY_HOPES",
      apiUrl: HOSTPINNACLE_SEND_URL,
      duplicateCheck: false,
    });
  });

  it("lets duplicatecheck be opted into, but never by default", () => {
    const base = {
      HOSTPINNACLE_USER_ID: "ammyhopes",
      HOSTPINNACLE_PASSWORD: "secret",
    };
    expect(readHostPinnacleConfig(base)?.duplicateCheck).toBe(false);
    expect(
      readHostPinnacleConfig({ ...base, HOSTPINNACLE_DUPLICATE_CHECK: "TRUE" })
        ?.duplicateCheck,
    ).toBe(true);
    expect(
      readHostPinnacleConfig({ ...base, HOSTPINNACLE_DUPLICATE_CHECK: "false" })
        ?.duplicateCheck,
    ).toBe(false);
  });
});

describe("normalizeSmsMsisdn", () => {
  it("normalizes the Safaricom forms to 254…", () => {
    expect(normalizeSmsMsisdn("0712345678")).toBe("254712345678");
    expect(normalizeSmsMsisdn("+254712345678")).toBe("254712345678");
    expect(normalizeSmsMsisdn("254712345678")).toBe("254712345678");
    expect(normalizeSmsMsisdn(" 0712 345-678 ")).toBe("254712345678");
  });

  it("also accepts 01… numbers, unlike the M-Pesa normalizer", () => {
    expect(normalizeSmsMsisdn("0110123456")).toBe("254110123456");
    expect(normalizeSmsMsisdn("+254110123456")).toBe("254110123456");
  });

  it("rejects anything unroutable", () => {
    for (const bad of ["12345", "0812345678", "25471234567", "+255712345678", ""]) {
      expect(() => normalizeSmsMsisdn(bad)).toThrow(/Unroutable phone number/);
    }
  });
});

describe("buildSendPayload", () => {
  it("matches the documented JSON contract", () => {
    expect(
      buildSendPayload(CONFIG, [{ mobile: "0712345678", msg: "Your OTP is 483921." }]),
    ).toEqual({
      userid: "ammyhopes",
      password: "secret",
      senderid: "AMMY_HOPES",
      msgType: "text",
      duplicatecheck: "false",
      sendMethod: "quick",
      sms: [{ mobile: ["254712345678"], msg: "Your OTP is 483921." }],
    });
  });

  it("stringifies duplicatecheck (the API wants a string, not a boolean)", () => {
    const payload = buildSendPayload({ ...CONFIG, duplicateCheck: true }, [
      { mobile: "0712345678", msg: "hi" },
    ]);
    expect(payload.duplicatecheck).toBe("true");
    expect(JSON.parse(JSON.stringify(payload)).duplicatecheck).toBe("true");
  });

  it("supports a batch and rejects an empty one", () => {
    const payload = buildSendPayload(CONFIG, [
      { mobile: "0712345678", msg: "one" },
      { mobile: "0723456789", msg: "two" },
    ]);
    expect(payload.sms).toHaveLength(2);
    expect(payload.sms[1]).toEqual({ mobile: ["254723456789"], msg: "two" });
    expect(() => buildSendPayload(CONFIG, [])).toThrow(/No SMS messages/);
  });

  it("propagates a bad number instead of sending to nowhere", () => {
    expect(() =>
      buildSendPayload(CONFIG, [{ mobile: "not-a-phone", msg: "hi" }]),
    ).toThrow(/Unroutable phone number/);
  });
});

describe("interpretSendResponse", () => {
  it("accepts a success envelope", () => {
    expect(
      interpretSendResponse(200, '{"status":"success","transactionId":"abc123"}'),
    ).toEqual({ ok: true });
    expect(
      interpretSendResponse(
        200,
        '{"status":"success","data":[{"mobile":"254712345678","status":"queued"}]}',
      ),
    ).toEqual({ ok: true });
  });

  it("treats an HTTP-200 rejection as a failure — the whole point", () => {
    const outcome = interpretSendResponse(
      200,
      '{"status":"error","reason":"Invalid Credentials"}',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/Invalid Credentials/);
  });

  it("lets a per-message rejection override a success envelope", () => {
    const outcome = interpretSendResponse(
      200,
      '{"status":"success","data":[{"status":"failed","reason":"SenderId not approved"}]}',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/SenderId not approved/);
  });

  it("fails closed on transport errors and unparseable bodies", () => {
    expect(interpretSendResponse(401, "Unauthorized").ok).toBe(false);
    expect(interpretSendResponse(500, "").error).toBe("HostPinnacle HTTP 500");
    expect(interpretSendResponse(200, "<html>Gateway</html>").error).toMatch(
      /Unrecognized HostPinnacle response/,
    );
    expect(interpretSendResponse(200, "").error).toMatch(/\(empty body\)/);
    // Valid JSON, no status field we understand — still not a delivery signal.
    expect(interpretSendResponse(200, '{"foo":"bar"}').ok).toBe(false);
  });

  it("keeps the recorded error one line and bounded", () => {
    const outcome = interpretSendResponse(200, `x\n${"y".repeat(600)}`);
    expect(outcome.error).not.toMatch(/\n/);
    expect(outcome.error!.length).toBeLessThan(360);
  });
});
