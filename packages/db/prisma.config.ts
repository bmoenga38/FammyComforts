import { defineConfig } from "prisma/config";

/**
 * Prisma 7 config (replaces the schema `datasource.url`). The CLI / Migrate read
 * the connection URL from here; the runtime client connects via a driver adapter
 * (see the API's PrismaService). `DATABASE_URL` is documented in `.env.example`.
 *
 * The datasource is only attached when `DATABASE_URL` is set, so `prisma generate`
 * (which needs no DB) works offline / in fresh clones; `prisma migrate` requires
 * the env var and fails clearly when it's missing.
 */
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(url ? { datasource: { url } } : {}),
});
