'use client'

import { useState, useTransition } from 'react'
import { formatRelativeDateTime } from '@/lib/dates'
import { AUDIT_ACTION_LABELS } from '@/lib/audit-model'
import { loadMoreRecordHistory } from '@/lib/actions/audit'
import { buttonSecondaryClass } from '@/components/ui/form'
import { DiffTable } from './DiffTable'

const ACTION_CLASSES: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700 ring-green-200',
  UPDATE: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELETE: 'bg-red-50 text-red-700 ring-red-200',
}

export type RecordHistoryEntry = {
  id: string
  userName: string
  action: string
  changedFields: unknown
  createdAt: string // serialized ISO — see AuditEntryList for why
}

function HistoryCard({ entry }: { entry: RecordHistoryEntry }) {
  const { relative, exact } = formatRelativeDateTime(new Date(entry.createdAt))

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
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
      <DiffTable action={entry.action as 'CREATE' | 'UPDATE' | 'DELETE'} changedFields={entry.changedFields} />
    </div>
  )
}

/** The stateful half of RecordHistoryPanel — holds the accumulated pages
 * so "Load more" can append rather than re-fetching everything, same
 * pattern as AuditEntryList. */
export function RecordHistoryList({
  entityType,
  entityId,
  initialEntries,
  initialHasMore,
}: {
  entityType: string
  entityId: string
  initialEntries: RecordHistoryEntry[]
  initialHasMore: boolean
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isPending, startTransition] = useTransition()

  function loadMore() {
    const last = entries[entries.length - 1]
    if (!last) return

    startTransition(async () => {
      const result = await loadMoreRecordHistory(entityType, entityId, last.id)
      setEntries((prev) => [
        ...prev,
        ...result.entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      ])
      setHasMore(result.hasMore)
    })
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <HistoryCard key={entry.id} entry={entry} />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className={buttonSecondaryClass}
          >
            {isPending ? 'Loading…' : 'Load 5 more'}
          </button>
        </div>
      )}
    </div>
  )
}
