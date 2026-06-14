import { ConvexError } from "convex/values";

/**
 * Throw a user-facing error whose message actually reaches the browser.
 *
 * Convex REDACTS plain `throw new Error(...)` messages on production
 * deployments — the client only sees "[CONVEX] Server Error <request id>".
 * `ConvexError` is the documented exception: its `data` is always delivered to
 * the client. So every validation/business-rule failure a guest or staff
 * member should be able to read goes through `userError()`, and the web layer
 * surfaces it via `errorMessage()` (apps/web/src/lib/error-message.ts).
 *
 * Reserve plain `throw new Error()` for true invariants that should never be
 * reachable with valid input (those staying redacted in prod is fine).
 */
export function userError(message: string): never {
  throw new ConvexError(message);
}
