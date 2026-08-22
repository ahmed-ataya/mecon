'use server'

import { requireAdmin } from '../auth/guard'
import { parseAuditFilters, loadMoreAuditEntriesQuery } from '../audit-queries'

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
