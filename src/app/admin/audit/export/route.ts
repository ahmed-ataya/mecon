import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewAudit } from '@/lib/permissions'
import { humanizeModelName } from '@/lib/audit-model'
import { loadAllAuditEntriesForExport, parseAuditFilters } from '@/lib/audit-queries'
import { toCsv } from '@/lib/csv'

/** The current FILTERED set, not the whole table — same filter parsing as
 * the page itself, from the query string the "Export CSV" link carries. */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || !canViewAudit(user.role)) {
    return new NextResponse('Audit log is visible to Admin only.', { status: 403 })
  }

  const url = new URL(request.url)
  const filters = parseAuditFilters(Object.fromEntries(url.searchParams))

  const entries = await loadAllAuditEntriesForExport(filters)

  const rows: (string | number)[][] = [
    ['When', 'Who', 'Action', 'Record type', 'Record', 'Field', 'Was', 'Now'],
  ]

  for (const entry of entries) {
    const changed = Array.isArray(entry.changedFields) ? entry.changedFields : null
    const base = [
      entry.createdAt.toISOString(),
      entry.userName,
      entry.action,
      humanizeModelName(entry.entityType),
      entry.entityLabel ?? entry.entityId,
    ]

    if (!changed || changed.length === 0) {
      rows.push([...base, '', '', ''])
      continue
    }

    for (const field of changed) {
      if (typeof field !== 'object' || field === null) continue
      const row = field as Record<string, unknown>
      rows.push([...base, String(row.field ?? ''), String(row.was ?? ''), String(row.now ?? '')])
    }
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
