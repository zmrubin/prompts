/**
 * A signed session cookie, deliberately tiny.
 *
 * The entire payload is "this browser logged in, until <expiry>" — there is
 * one user and no profile to carry. That doesn't need an encrypted session
 * library, so this is an HMAC over the expiry and nothing else.
 *
 * Built on Web Crypto rather than node:crypto so the identical verification
 * runs in middleware (edge runtime) and in route handlers (node runtime). A
 * second implementation for the edge is a second thing to get subtly wrong.
 */

export const COOKIE_NAME = 'pr_agent_session'
const TTL_MS = 1000 * 60 * 60 * 24 * 30

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set to at least 32 characters when a dashboard password is configured. Generate one with `openssl rand -base64 32`.',
    )
  }
  return s
}

function b64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64url')
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
}

export async function createToken(now = Date.now()): Promise<string> {
  const exp = String(now + TTL_MS)
  return `${exp}.${await sign(exp)}`
}

export async function verifyToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const exp = token.slice(0, dot)
  const mac = token.slice(dot + 1)

  const expected = await sign(exp)
  // Compare before trusting the expiry: an attacker who can pick `exp` freely
  // would otherwise get an oracle for whether their forgery parsed.
  if (!timingSafeEqualStrings(mac, expected)) return false

  const at = Number(exp)
  return Number.isFinite(at) && at > now
}

/** Length-independent compare — no early return on the first differing byte. */
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TTL_MS / 1000,
  }
}
