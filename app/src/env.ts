import { z } from 'zod'

/**
 * Fail fast and loudly on a bad environment rather than at the first query.
 * ENCRYPTION_KEY is checked for real length here because a short key produces
 * a confusing crypto error deep inside a connector otherwise.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .min(1, 'ENCRYPTION_KEY is required')
    .refine(
      (v) => Buffer.from(v, 'base64').length === 32,
      'ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)',
    ),
  ADMIN_PASSWORD_HASH: z.string().min(1, 'ADMIN_PASSWORD_HASH is required'),
  /**
   * Master safety switch, independent of the DB setting. When this is "true"
   * nothing can post for real, no matter what the dashboard says.
   */
  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  APP_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

let cached: z.infer<typeof schema> | null = null

export function env() {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment:\n${issues}`)
  }
  cached = parsed.data
  return cached
}
