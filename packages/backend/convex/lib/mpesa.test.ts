// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalizeMsisdn,
  centsToWholeShillings,
  darajaTimestamp,
  stkPassword,
  parseStkCallback,
} from "./mpesa";

describe("normalizeMsisdn (spec §3)", () => {
  it("accepts the three documented forms → 2547XXXXXXXX", () => {
    expect(normalizeMsisdn("0712345678")).toBe("254712345678");
    expect(normalizeMsisdn("+254712345678")).toBe("254712345678");
    expect(normalizeMsisdn("254712345678")).toBe("254712345678");
    expect(normalizeMsisdn(" 0712 345-678 ")).toBe("254712345678");
  });

  it("rejects anything else", () => {
    for (const bad of ["12345", "0812345678", "25471234567", "+25571234567", ""]) {
      expect(() => normalizeMsisdn(bad)).toThrow(/valid Safaricom/);
    }
  });
});

describe("centsToWholeShillings", () => {
  it("converts whole shillings and rejects fractions/non-positive", () => {
    expect(centsToWholeShillings(350000n)).toBe(3500);
    expect(() => centsToWholeShillings(350050n)).toThrow(/whole shillings/);
    expect(() => centsToWholeShillings(0n)).toThrow(/positive/);
  });
});

describe("darajaTimestamp + stkPassword (spec §3)", () => {
  it("formats Africa/Nairobi (UTC+3) as YYYYMMDDHHmmss", () => {
    // 2026-06-04T12:15:30Z → 15:15:30 in Nairobi.
    const ts = darajaTimestamp(Date.UTC(2026, 5, 4, 12, 15, 30));
    expect(ts).toBe("20260604151530");
  });

  it("password = base64(shortcode + passkey + timestamp)", () => {
    const ts = "20260604151530";
    expect(stkPassword("174379", "pk", ts)).toBe(btoa(`174379pk${ts}`));
  });
});

describe("parseStkCallback (spec §4)", () => {
  const success = {
    Body: {
      stkCallback: {
        MerchantRequestID: "m-1",
        CheckoutRequestID: "ws_CO_1",
        ResultCode: 0,
        ResultDesc: "Processed",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 3500 },
            { Name: "MpesaReceiptNumber", Value: "QABC123XYZ" },
            { Name: "TransactionDate", Value: 20260604121530 },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
      },
    },
  };

  it("extracts success metadata", () => {
    expect(parseStkCallback(success)).toEqual({
      merchantRequestId: "m-1",
      checkoutRequestId: "ws_CO_1",
      resultCode: 0,
      resultDesc: "Processed",
      amountKes: 3500,
      receiptNumber: "QABC123XYZ",
      phone: "254712345678",
    });
  });

  it("handles a failure callback (no metadata)", () => {
    const parsed = parseStkCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: "m-2",
          CheckoutRequestID: "ws_CO_2",
          ResultCode: 1032,
          ResultDesc: "Request cancelled by user",
        },
      },
    });
    expect(parsed.resultCode).toBe(1032);
    expect(parsed.receiptNumber).toBeUndefined();
  });

  it("throws on a non-callback body", () => {
    expect(() => parseStkCallback({ hello: "world" })).toThrow(/Not a Daraja/);
  });
});
