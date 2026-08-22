import { db } from './db'
import type { CurrentUser } from './auth/session'

/**
 * One row per create/update/delete — see AuditLog's model comment in
 * schema.prisma for why userName/entityLabel are snapshots. Every mutating
 * Server Action calls this after its write succeeds, right after the
 * requireWrite()/requireDelete() guard that already resolved `user`.
 */
export async function logAudit({
  user,
  action,
  entityType,
  entityId,
  entityLabel,
}: {
  user: CurrentUser
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  entityType: string
  entityId: string
  entityLabel?: string | null
}): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: user.id,
      userName: user.name,
      action,
      entityType,
      entityId,
      entityLabel: entityLabel ?? null,
    },
  })
}
