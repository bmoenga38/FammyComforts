import { errorMessage } from "./error-message";
import { notify } from "@/components/ui/toast";

/**
 * The one place a failed Convex call turns into something a human can act on.
 *
 * Three things used to go wrong at every call site, and this fixes all three:
 *
 * 1. `String(err.message ?? err)` on a production Convex failure renders the
 *    literal string `[CONVEX M(rooms:update)] [Request ID: …] Server Error`.
 *    Convex redacts plain `throw new Error()` messages on prod deployments, so
 *    the real reason ("Room 101 already exists in this branch.") never arrives.
 *    The backend now throws `ConvexError` via `userError()`; `errorMessage()`
 *    unwraps it.
 * 2. Some call sites showed the message inline, some only in a `.catch()` that
 *    set text far from the button, some swallowed it. Now every failure raises a
 *    toast as well, so nothing is silent.
 * 3. Errors that fell through to a generic string lost the useful detail.
 *
 * Returns the readable message so a call site can keep its inline text with a
 * one-line change:
 *
 * ```ts
 * } catch (e) {
 *   setError(reportError(e));   // inline text *and* a toast
 * }
 * ```
 *
 * Use {@link reportSuccess} for the happy path so confirmations look the same.
 */
export function reportError(err: unknown): string {
  const message = errorMessage(err);
  notify(message, { variant: "error" });
  return message;
}

/** Confirmation toast, so success and failure are styled by one pair of helpers. */
export function reportSuccess(message: string): string {
  notify(message, { variant: "success" });
  return message;
}
