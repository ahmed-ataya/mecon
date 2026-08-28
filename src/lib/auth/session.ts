import { randomBytes } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { db } from '../db'
import type { UserRole } from '../enums'

/**
 * Session mechanics — a random opaque token in an httpOnly cookie, checked
 * against the database on every read. See the Session model's comment in
 * schema.prisma for why this beats a JWT for this app's scale.
 */

const COOKIE_NAME = 'mecon_session'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await db.session.create({ data: { token, userId, expiresAt } })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

/**
 * Server Components and Server Actions both call this directly rather than
 * trusting anything proxy.ts may have already checked — Next's own guidance
 * is explicit that proxy is a first line of defense, not a substitute for
 * checking inside each Server Function. See src/proxy.ts's comment.
 *
 * Wrapped in React's `cache()` (request memoization, not a cross-request
 * cache — it's cleared automatically once the request finishes): the
 * layout calls this once for the sidebar, then nearly every page's own
 * guard (requirePageUser, requireAdminPage, ...) calls it again, and a
 * mutating action's requireWrite()/requireDelete() calls it again after
 * that. Before this, that meant 2-4 identical session lookups hitting the
 * database on a single page load, all resolving the same token to the
 * same user. Real, measured impact: see ROADMAP.md's performance
 * investigation, 2026-08-28.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session) return null

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as UserRole,
  }
})

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (token) {
    await db.session.deleteMany({ where: { token } })
  }

  cookieStore.delete(COOKIE_NAME)
}
