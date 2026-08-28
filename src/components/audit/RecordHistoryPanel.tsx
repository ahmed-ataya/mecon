import Link from 'next/link'
import { loadRecordHistory } from '@/lib/audit-queries'
import { RecordHistoryList } from './RecordHistoryList'

/**
 * The audit trail entry point everywhere BUT the audit log itself — every
 * record detail page gets one of these below its own details, using the
 * same DiffTable the audit page's expanded rows use, so a field always
 * reads the same way regardless of where it's seen. Server Component: it
 * queries directly rather than taking pre-loaded data as a prop, since
 * every one of its ~10 call sites would otherwise have to repeat the same
 * loadRecordHistory call. Paginated (RecordHistoryList) so a long-lived
 * record's history can't turn this into an endless scroll.
 */
export async function RecordHistoryPanel({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}) {
  const { entries, hasMore } = await loadRecordHistory(entityType, entityId)

  return (
    <section>
      <h2 className="mb-2.5 text-sm font-semibold text-slate-900">Change history</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No changes recorded for this record yet.</p>
      ) : (
        <RecordHistoryList
          entityType={entityType}
          entityId={entityId}
          initialEntries={entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))}
          initialHasMore={hasMore}
        />
      )}

      <Link
        href={`/admin/audit?type=${encodeURIComponent(entityType)}`}
        className="mt-2.5 inline-block text-xs text-slate-400 hover:text-slate-700 hover:underline"
      >
        View all {entityType} changes in the audit log →
      </Link>
    </section>
  )
}
