import Link from 'next/link'
import { formatRelativeDateTime } from '@/lib/dates'
import { AUDIT_ACTION_LABELS } from '@/lib/audit-model'
import { loadRecordHistory } from '@/lib/audit-queries'
import { DiffTable } from './DiffTable'

const ACTION_CLASSES: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700 ring-green-200',
  UPDATE: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELETE: 'bg-red-50 text-red-700 ring-red-200',
}

/**
 * The audit trail entry point everywhere BUT the audit log itself — every
 * record detail page gets one of these below its own details, using the
 * same DiffTable the audit page's expanded rows use, so a field always
 * reads the same way regardless of where it's seen. Server Component: it
 * queries directly rather than taking pre-loaded data as a prop, since
 * every one of its ~9 call sites would otherwise have to repeat the same
 * loadRecordHistory call.
 */
export async function RecordHistoryPanel({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}) {
  const history = await loadRecordHistory(entityType, entityId)

  return (
    <section>
      <h2 className="mb-2.5 text-sm font-semibold text-slate-900">Change history</h2>

      {history.length === 0 ? (
        <p className="text-sm text-slate-500">No changes recorded for this record yet.</p>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => {
            const { relative, exact } = formatRelativeDateTime(entry.createdAt)
            return (
              <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2.5 flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                  <span className="font-mono">
                    {relative} <span className="text-slate-400">· {exact}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] uppercase ring-1 ring-inset ${ACTION_CLASSES[entry.action] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}
                  >
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span>
                    by <span className="font-medium text-slate-700">{entry.userName}</span>
                  </span>
                </div>
                <DiffTable
                  action={entry.action as 'CREATE' | 'UPDATE' | 'DELETE'}
                  changedFields={entry.changedFields}
                />
              </div>
            )
          })}
        </div>
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
