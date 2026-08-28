import { db } from './db'
import { parseDateInput } from './dates'
import type { Prisma } from '@prisma/client'

/**
 * Filter state for the audit log — parsed once from URL search params so
 * the page, the "Load more" action and the CSV export all agree on
 * exactly the same filtered set. See AuditFiltersBar for how these map to
 * the URL.
 */
export type AuditRangeKey = '7' | '30' | '90' | 'ALL' | 'custom'

export type AuditFilters = {
  q: string
  action: 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'
  range: AuditRangeKey
  from: string // YYYY-MM-DD, only meaningful when range === 'custom'
  to: string
  user: string // userName, or 'ALL'
  type: string // entityType, or 'ALL'
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  q: '',
  action: 'ALL',
  range: '30',
  from: '',
  to: '',
  user: 'ALL',
  type: 'ALL',
}

export function parseAuditFilters(
  params: Record<string, string | string[] | undefined>,
): AuditFilters {
  const str = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
  }

  const action = str('action')
  const range = str('range')

  return {
    q: str('q'),
    action: ['CREATE', 'UPDATE', 'DELETE'].includes(action)
      ? (action as AuditFilters['action'])
      : 'ALL',
    range: ['7', '30', '90', 'ALL', 'custom'].includes(range)
      ? (range as AuditRangeKey)
      : '30',
    from: str('from'),
    to: str('to'),
    user: str('user') || 'ALL',
    type: str('type') || 'ALL',
  }
}

/** Whether the current filters differ from the defaults — drives the
 * "Clear" link, which only appears when there's something to clear. */
export function isAuditFiltersDirty(filters: AuditFilters): boolean {
  return (
    filters.q !== '' ||
    filters.action !== 'ALL' ||
    filters.range !== '30' ||
    filters.user !== 'ALL' ||
    filters.type !== 'ALL'
  )
}

function rangeStart(filters: AuditFilters): Date | null {
  if (filters.range === 'ALL') return null
  if (filters.range === 'custom') return parseDateInput(filters.from)
  const days = Number(filters.range)
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function rangeEnd(filters: AuditFilters): Date | null {
  if (filters.range !== 'custom') return null
  const to = parseDateInput(filters.to)
  if (!to) return null
  // Inclusive of the whole "to" day.
  return new Date(to.getTime() + 24 * 60 * 60 * 1000)
}

export const AUDIT_RANGE_LABELS: Record<AuditRangeKey, string> = {
  '7': 'last 7 days',
  '30': 'last 30 days',
  '90': 'last 3 months',
  ALL: 'all time',
  custom: 'custom range',
}

function buildWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {}

  if (filters.action !== 'ALL') where.action = filters.action
  if (filters.user !== 'ALL') where.userName = filters.user
  if (filters.type !== 'ALL') where.entityType = filters.type

  const start = rangeStart(filters)
  const end = rangeEnd(filters)
  if (start || end) {
    where.createdAt = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lt: end } : {}),
    }
  }

  const q = filters.q.trim()
  if (q) {
    where.OR = [
      { entityLabel: { contains: q, mode: 'insensitive' } },
      { entityType: { contains: q, mode: 'insensitive' } },
      { userName: { contains: q, mode: 'insensitive' } },
    ]
  }

  return where
}

const PAGE_SIZE = 12

/** First page — always a fresh query from the top, no cursor. "Load more"
 * (loadMoreAuditEntries, a Server Action) takes it from here with a real
 * Prisma cursor. */
export async function loadAuditEntries(filters: AuditFilters) {
  const where = buildWhere(filters)

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    }),
    db.auditLog.count({ where }),
  ])

  const hasMore = entries.length > PAGE_SIZE
  return { entries: entries.slice(0, PAGE_SIZE), total, hasMore }
}

/** Cursor-based continuation — a real indexed seek via Prisma's
 * `cursor`/`skip: 1`, not an OFFSET that gets slower as the log grows.
 * `afterId` is the last row's id the caller already has. */
export async function loadMoreAuditEntriesQuery(filters: AuditFilters, afterId: string) {
  const where = buildWhere(filters)

  const entries = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    cursor: { id: afterId },
    skip: 1,
    take: PAGE_SIZE + 1,
  })

  const hasMore = entries.length > PAGE_SIZE
  return { entries: entries.slice(0, PAGE_SIZE), hasMore }
}

/** Every row matching the current filters, for CSV export — the filtered
 * set, not the whole table. No take limit; this is a deliberate full scan
 * of a bounded, already-filtered result, run once per export click. */
export async function loadAllAuditEntriesForExport(filters: AuditFilters) {
  return db.auditLog.findMany({
    where: buildWhere(filters),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}

/** Populates the User and Record type selects — every distinct value that
 * actually appears in the log, not a fixed list, so a select never offers
 * a choice that would return zero rows. */
export async function loadAuditFilterOptions() {
  const [users, types] = await Promise.all([
    db.auditLog.findMany({ distinct: ['userName'], select: { userName: true }, orderBy: { userName: 'asc' } }),
    db.auditLog.findMany({ distinct: ['entityType'], select: { entityType: true } }),
  ])

  return {
    users: users.map((u) => u.userName),
    types: types.map((t) => t.entityType).sort(),
  }
}

const RECORD_HISTORY_PAGE_SIZE = 5

/** One record's history, most recent first — the per-record "Change
 * history" panel. Paginated the same way the audit log itself is: a long-
 * lived record (a contract edited 40 times over a year) would otherwise
 * render an ever-growing stack of cards on its own detail page. The
 * (entityType, entityId) index is what keeps this fast regardless of how
 * large the overall log gets. First page only; loadMoreRecordHistoryQuery
 * continues it with a real cursor. */
export async function loadRecordHistory(entityType: string, entityId: string) {
  const entries = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: RECORD_HISTORY_PAGE_SIZE + 1,
  })

  const hasMore = entries.length > RECORD_HISTORY_PAGE_SIZE
  return { entries: entries.slice(0, RECORD_HISTORY_PAGE_SIZE), hasMore }
}

/** Cursor-based continuation for loadRecordHistory — see
 * loadMoreAuditEntriesQuery for why cursor, not OFFSET. */
export async function loadMoreRecordHistoryQuery(
  entityType: string,
  entityId: string,
  afterId: string,
) {
  const entries = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    cursor: { id: afterId },
    skip: 1,
    take: RECORD_HISTORY_PAGE_SIZE + 1,
  })

  const hasMore = entries.length > RECORD_HISTORY_PAGE_SIZE
  return { entries: entries.slice(0, RECORD_HISTORY_PAGE_SIZE), hasMore }
}

/** Whether this id's last audit entry for this model was a DELETE — used
 * to show "This record was deleted" instead of a bare 404. */
export async function findDeletionRecord(entityType: string, entityId: string) {
  return db.auditLog.findFirst({
    where: { entityType, entityId, action: 'DELETE' },
    orderBy: { createdAt: 'desc' },
  })
}
