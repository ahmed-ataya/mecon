import Link from 'next/link'
import { requireAuditPage } from '@/lib/auth/guard'
import {
  AUDIT_RANGE_LABELS,
  isAuditFiltersDirty,
  loadAuditEntries,
  loadAuditFilterOptions,
  parseAuditFilters,
} from '@/lib/audit-queries'
import { AuditFilterBar } from '@/components/audit/AuditFilterBar'
import { AuditEntryList } from '@/components/audit/AuditEntryList'
import { PageHeader } from '@/components/shell/PageHeader'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuditPage()

  const rawParams = await searchParams
  const filters = parseAuditFilters(rawParams)
  const dirty = isAuditFiltersDirty(filters)

  const [{ entries, total, hasMore }, { users, types }] = await Promise.all([
    loadAuditEntries(filters),
    loadAuditFilterOptions(),
  ])

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every record created, changed or deleted across Mecon. Visible to admins only."
        actions={
          <Link href={buildExportHref(filters)} className={buttonSecondaryClass}>
            Export CSV
          </Link>
        }
      />

      <AuditFilterBar filters={filters} users={users} types={types} dirty={dirty} />

      <div className="flex items-baseline justify-between gap-4 py-3 text-[12.5px] text-slate-500">
        <span>
          Showing <strong className="font-mono font-medium text-slate-700">{entries.length}</strong> of{' '}
          <strong className="font-mono font-medium text-slate-700">{total.toLocaleString()}</strong> changes
          {' · '}
          {AUDIT_RANGE_LABELS[filters.range]}
        </span>
        {entries.length > 0 && <span className="hidden sm:inline">Click a row to see what changed</span>}
      </div>

      {entries.length === 0 ? (
        <div className="my-5 rounded-lg border border-dashed border-slate-200 px-5 py-11 text-center">
          {total === 0 && !dirty ? (
            <p className="text-sm text-slate-500">
              No changes recorded yet. Activity will appear here as records are created and
              edited.
            </p>
          ) : (
            <>
              <p className="mb-3.5 text-sm text-slate-500">No changes match these filters.</p>
              <Link href="/admin/audit" className={buttonSecondaryClass}>
                Clear filters
              </Link>
            </>
          )}
        </div>
      ) : (
        <AuditEntryList
          // Remounts on every filter change — the "Load more" state this
          // component keeps locally must never survive a new filtered
          // query, so a key tied to the actual filters (not just a
          // stable component identity) is the fix, not an effect that
          // resyncs state after the fact.
          key={JSON.stringify(filters)}
          initialEntries={entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))}
          initialHasMore={hasMore}
          filters={filters}
        />
      )}
    </div>
  )
}

function buildExportHref(filters: ReturnType<typeof parseAuditFilters>): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.action !== 'ALL') params.set('action', filters.action)
  if (filters.range !== '30') params.set('range', filters.range)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.user !== 'ALL') params.set('user', filters.user)
  if (filters.type !== 'ALL') params.set('type', filters.type)
  const query = params.toString()
  return `/admin/audit/export${query ? `?${query}` : ''}`
}
