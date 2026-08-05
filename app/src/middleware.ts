import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_NAME, verifyToken } from '@/lib/session'

/**
 * One chokepoint for the human-facing surface. Scattering `requireAuth()`
 * calls across pages means the next page anyone adds is unprotected by
 * default; here, everything is protected unless it is named below.
 *
 * /api/mcp is exempt on purpose — it is called by Anthropic's cloud, which
 * has no cookie jar, and it does its own bearer-token check.
 */
const PUBLIC = ['/login', '/api/auth/login', '/api/mcp']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  if (!process.env.ADMIN_PASSWORD_HASH) {
    /**
     * No password on a local machine means a single user on localhost, where
     * a login form is pure friction. No password in production means a
     * misconfigured deploy, and the safe reading of that is "serve nothing"
     * rather than "serve everything to the public internet".
     */
    if (process.env.NODE_ENV === 'production') {
      console.error('ADMIN_PASSWORD_HASH is not set — refusing to serve the dashboard.')
      return new NextResponse('ADMIN_PASSWORD_HASH is not set on this deployment.', {
        status: 503,
      })
    }
    return NextResponse.next()
  }

  return verifyToken(req.cookies.get(COOKIE_NAME)?.value).then((ok) => {
    if (ok) return NextResponse.next()

    if (pathname.startsWith('/api/')) {
      return new NextResponse(null, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  })
}

export const config = {
  // Everything except Next's own static output and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
