import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { parseStkCallback } from "./lib/mpesa";

/**
 * HTTP routes. Convex Auth mounts its sign-in / token endpoints here
 * (`auth.addHttpRoutes`); Daraja posts STK results to /mpesa/callback/<token>.
 */
const http = httpRouter();
auth.addHttpRoutes(http);

// Story 5.4 — Daraja STK callback. The per-org shared token is the last path
// segment; verification happens inside the transactional mutation (it must
// match the org that owns the CheckoutRequestID). Always 200 to Daraja for
// processed/unmatched results (spec §4.1/4.3); 401 only on a bad token.
http.route({
  pathPrefix: "/mpesa/callback/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).pathname.split("/").pop() ?? "";
    let parsed;
    try {
      parsed = parseStkCallback(await request.json());
    } catch {
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Bad payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const result = await ctx.runMutation(internal.mpesa.processStkResult, {
      callbackToken: token,
      checkoutRequestId: parsed.checkoutRequestId,
      resultCode: parsed.resultCode,
      resultDesc: parsed.resultDesc,
      amountKes: parsed.amountKes,
      receiptNumber: parsed.receiptNumber,
      phone: parsed.phone,
    });
    if (result.outcome === "unauthorized") {
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
