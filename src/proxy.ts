import { NextResponse, type NextRequest } from 'next/server'
import { db } from './lib/db'

/**
 * Real session-based access control — replaces the earlier shared-password
 * review gate. That gate had no accounts, no roles and no audit trail;
 * this checks an actual signed-in user on every request. Role-specific
 * checks (payroll visibility, who can delete, etc.) live per-page and
 * per-action (src/lib/permissions.ts, src/lib/auth/guard.ts) — this layer
 * only answers "is someone logged in at all."
 *
 * Proxy defaults to the Node.js runtime as of Next.js 16 (previously Edge),
 * which is what makes a real Prisma lookup here safe — see
 * node_modules/next/dist/docs/.../file-conventions/proxy.md's Runtime
 * section. Next's own guidance is still to treat this as a first line of
 * defense, not the only check — every Server Action re-verifies for itself
 * (src/lib/auth/guard.ts), since a matcher change here could otherwise
 * silently stop covering a route.
 */

const COOKIE_NAME = 'mecon_session'
const PUBLIC_PATHS = new Set(['/login'])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const token = request.cookies.get(COOKIE_NAME)?.value

  if (token) {
    const session = await db.session.findUnique({ where: { token } })
    if (session && session.expiresAt > new Date()) {
      return NextResponse.next()
    }
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  // Everything except Next's own static assets — the gate has to cover the
  // server actions that mutate data, not just the pages.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
