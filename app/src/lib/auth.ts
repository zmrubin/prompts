import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Two independent doors into this app, because two different callers knock:
 *
 *  - The MCP endpoint is called by Anthropic's cloud on your behalf. It has no
 *    browser and no cookie jar, so it authenticates with a fixed bearer token
 *    supplied as a connector request header.
 *  - The dashboard is used by a human, so it gets a password and a cookie.
 */

/** Constant-time compare that doesn't leak length through early return. */
export function secretsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // timingSafeEqual throws on a length mismatch, so hash both to a fixed width
  // first — otherwise the throw itself is the timing side channel.
  const keyA = scryptSync(bufA, 'pr-agent-compare', 32)
  const keyB = scryptSync(bufB, 'pr-agent-compare', 32)
  return timingSafeEqual(keyA, keyB)
}

/**
 * The MCP bearer token. Unset means the endpoint is closed rather than open:
 * an unauthenticated MCP server on a public URL hands anyone who finds it the
 * ability to read and rewrite every launch plan.
 */
export function mcpToken(): string | undefined {
  return process.env.MCP_TOKEN
}

export function bearerFrom(req: Request): string | undefined {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header) return undefined
  const [scheme, ...rest] = header.split(' ')
  if (scheme.toLowerCase() !== 'bearer') return undefined
  return rest.join(' ').trim() || undefined
}

export function mcpRequestIsAuthorized(req: Request): boolean {
  const expected = mcpToken()
  if (!expected) return false
  return secretsMatch(bearerFrom(req), expected)
}

// ---------------------------------------------------------------------------
// Dashboard password
// ---------------------------------------------------------------------------

/**
 * Colon-separated, not `$`-separated. Next runs .env through dotenv-expand,
 * which silently ate everything after the first `$` in the old format and
 * made a correct password look wrong at the login form.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

/**
 * Login is required whenever a password is configured. Whether a *missing*
 * password is acceptable depends on where the app is running, and that call is
 * made once in middleware.ts rather than per-caller here.
 */
export function passwordHash(): string | undefined {
  return process.env.ADMIN_PASSWORD_HASH
}
