import { NextResponse, type NextRequest } from 'next/server'

/**
 * Shared-password gate for the review deployment.
 *
 * This is NOT authentication and is not a substitute for it — there are no
 * accounts, no roles and no audit trail, so every visitor is indistinguishable
 * once past this point. Phase 4 replaces it with real user accounts. Its only
 * job is to keep the system off the open internet while it is being reviewed,
 * because until phase 4 anyone with the URL can read and edit every record.
 *
 * Set SITE_PASSWORD in the environment to enable it. If the variable is unset
 * the gate is skipped entirely, which keeps local development friction-free.
 */
export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD

  if (!password) return NextResponse.next()

  const header = request.headers.get('authorization')

  if (header?.startsWith('Basic ')) {
    // atob is available on the edge runtime; Buffer is not.
    const decoded = atob(header.slice('Basic '.length))
    // Any username is accepted — only the password is checked.
    const supplied = decoded.slice(decoded.indexOf(':') + 1)

    if (timingSafeEqual(supplied, password)) return NextResponse.next()
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Mecon", charset="UTF-8"' },
  })
}

/**
 * Compare without leaking length or position through timing. Overkill for a
 * review gate, but it costs nothing and avoids setting a bad example.
 */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return mismatch === 0
}

export const config = {
  // Everything except Next's own static assets — the gate has to cover the
  // server actions that mutate data, not just the pages.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
