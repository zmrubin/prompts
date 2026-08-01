import 'server-only'
import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { env } from '@/env'

export type SessionData = { loggedIn?: boolean }

function options(): SessionOptions {
  return {
    password: env().SESSION_SECRET,
    cookieName: 'pr_agent_session',
    cookieOptions: {
      httpOnly: true,
      secure: env().NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    },
  }
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options())
}

/** Call at the top of every protected page and route handler. */
export async function requireAuth() {
  const session = await getSession()
  if (!session.loggedIn) redirect('/login')
}

export async function isAuthed(): Promise<boolean> {
  const session = await getSession()
  return Boolean(session.loggedIn)
}
