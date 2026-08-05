import { cookies } from 'next/headers'
import { COOKIE_NAME, cookieOptions } from '@/lib/session'

export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  const jar = await cookies()
  jar.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 })
  return new Response(null, { status: 204 })
}
