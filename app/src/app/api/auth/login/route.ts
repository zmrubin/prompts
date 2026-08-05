import { cookies } from 'next/headers'
import { passwordHash, verifyPassword } from '@/lib/auth'
import { COOKIE_NAME, cookieOptions, createToken } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const stored = passwordHash()
  if (!stored) {
    // No password configured means the middleware isn't gating anything, so
    // there is nothing to sign into.
    return new Response(null, { status: 404 })
  }

  let password = ''
  try {
    const body = (await req.json()) as { password?: unknown }
    if (typeof body.password === 'string') password = body.password
  } catch {
    return new Response(null, { status: 400 })
  }

  if (!verifyPassword(password, stored)) {
    return new Response(null, { status: 401 })
  }

  const jar = await cookies()
  jar.set(COOKIE_NAME, await createToken(), cookieOptions())
  return new Response(null, { status: 204 })
}
