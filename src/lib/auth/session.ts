import { randomBytes } from 'node:crypto'
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
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (token) {
    await db.session.deleteMany({ where: { token } })
  }

  cookieStore.delete(COOKIE_NAME)
}
