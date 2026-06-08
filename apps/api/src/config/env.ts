import { z } from 'zod';

/**
 * Typed environment contract (validated at boot via `@nestjs/config`). Required
 * vars fail fast; `DATABASE_URL` is optional so the API can boot without a DB in
 * this environment (the health endpoint then reports `db: "down"`). JWT/Redis/
 * M-Pesa vars are added by their owning epics.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule `validate` hook — throws (fails boot) on invalid env. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
