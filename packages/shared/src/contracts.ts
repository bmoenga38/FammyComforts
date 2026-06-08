/**
 * Shared web↔api contract (AR5). Zod schemas + inferred types are the single
 * source of truth: the API validates inputs with these (via a Nest Zod pipe)
 * and the web reuses them in React Hook Form resolvers. The response envelope
 * matches architecture.md#API-&-Communication-Patterns.
 */
import { z } from "zod";

// ---- Common primitives ----

/** A UUID (v7 in practice; the format check is version-agnostic). */
export const idSchema = z.uuid();

/** Standard list/pagination query (`?page=&pageSize=`), camelCase per AR. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ---- Dates: ISO-8601 UTC (AR5) ----

/** Validates an ISO-8601 datetime string. */
export const isoUtcSchema = z.iso.datetime();

/** Serialize a Date to an ISO-8601 UTC string (the on-the-wire date format). */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}

// ---- Response envelope (architecture.md) ----

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  [key: string]: unknown;
}

/** Success envelope: `{ data, meta? }`. */
export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}

/** Error envelope: `{ error: { code, message, details? } }`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

/** Wrap a payload in the success envelope. */
export function ok<T>(data: T, meta?: ApiMeta): ApiSuccess<T> {
  return meta ? { data, meta } : { data };
}

/** Build the error envelope with a stable string code. */
export function fail(
  code: string,
  message: string,
  details?: unknown[],
): ApiErrorBody {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

// ---- Health (exercised by GET /api/v1/health) ----

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.enum(["up", "down"]),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
