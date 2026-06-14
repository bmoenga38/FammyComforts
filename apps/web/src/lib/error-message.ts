import { ConvexError } from "convex/values";

/**
 * Turn any thrown value from a Convex call into a clean, user-readable string.
 *
 * Backend validation errors are thrown as `ConvexError` (see
 * packages/backend/convex/lib/errors.ts) precisely so their message survives
 * production redaction — here we pull that message out of `error.data`. Plain
 * `Error`s (and the redacted "[CONVEX] Server Error <id>" case) fall back to a
 * friendly generic so guests never see a raw stack or request id.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof ConvexError) {
    const data = err.data as unknown;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object" && "message" in data) {
      const m = (data as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) return m;
    }
    return "Something went wrong — please try again.";
  }
  if (err instanceof Error && err.message && !/\bServer Error\b/i.test(err.message)) {
    return err.message;
  }
  return "Something went wrong — please try again.";
}
