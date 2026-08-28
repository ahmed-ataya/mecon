'use server'

import { requireAdmin, requireUser } from '../auth/guard'
import {
  parseAuditFilters,
  loadMoreAuditEntriesQuery,
  loadMoreRecordHistoryQuery,
} from '../audit-queries'

/** Backs the audit log's "Load N more" button — a real cursor query, not
 * an ever-growing OFFSET. Re-parses the same filter shape the page itself
 * used, from plain params rather than trusting a client-constructed
 * Prisma query. */
export async function loadMoreAuditEntries(
  rawFilters: Record<string, string>,
  afterId: string,
) {
  await requireAdmin()

  const filters = parseAuditFilters(rawFilters)
  return loadMoreAuditEntriesQuery(filters, afterId)
}

/** Backs the "Load more" button on a record's own Change history panel.
 * Admin-only like the main audit log, this one is visible to anyone who
 * can see the record itself — same access level as the detail page it
 * lives on, not the standalone /admin/audit page. */
export async function loadMoreRecordHistory(
  entityType: string,
  entityId: string,
  afterId: string,
) {
  await requireUser()

  return loadMoreRecordHistoryQuery(entityType, entityId, afterId)
}
