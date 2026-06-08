/**
 * @sommycomfort/db — the Prisma client + schema (AR4).
 *
 * The schema lives at `prisma/schema.prisma`; regenerate the client with
 * `pnpm --filter @sommycomfort/db db:generate`. Consumers (the NestJS
 * PrismaService) import `PrismaClient` from here so the generated client has a
 * single import site. Tables are created per-story when first needed.
 */
export { PrismaClient, Prisma } from "@prisma/client";
export type { AuditLog } from "@prisma/client";
