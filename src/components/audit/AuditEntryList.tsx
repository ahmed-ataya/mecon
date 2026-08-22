'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { formatRelativeDateTime } from '@/lib/dates'
import { AUDIT_ACTION_LABELS, humanizeModelName, recordHref } from '@/lib/audit-model'
import type { AuditFilters } from '@/lib/audit-queries'
import { loadMoreAuditEntries } from '@/lib/actions/audit'
import { DiffTable } from './DiffTable'
import { buttonSecondaryClass } from '@/components/ui/form'

export type AuditEntryData = {
  id: string
  userName: string
  action: string
  entityType: string
  entityId: string
  entityLabel: string | null
  changedFields: unknown
  createdAt: string // serialized ISO — see the page for why
}

const ACTION_CLASSES: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700 ring-green-200',
  UPDATE: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELETE: 'bg-red-50 text-red-700 ring-red-200',
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function AuditRow({ entry }: { entry: AuditEntryData }) {
  const [open, setOpen] = useState(false)
  const { relative, exact } = formatRelativeDateTime(new Date(entry.createdAt))
  const href = recordHref(entry.entityType, entry.entityId, entry.action)

  return (
    <div className="border-b border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[104px_1fr_92px_28px] items-center gap-4 px-2.5 py-[9px] text-left hover:bg-slate-50 md:grid-cols-[132px_148px_92px_1fr_28px]"
      >
        <span className="font-mono text-xs whitespace-nowrap text-slate-700">
          {relative}
          <small className="block font-mono text-[10.5px] text-slate-400">{exact}</small>
        </span>

        <span className="hidden min-w-0 items-center gap-1.5 md:flex">
          <span className="grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-600">
            {initials(entry.userName)}
          </span>
          <span className="truncate text-sm text-slate-700">{entry.userName}</span>
        </span>

        <span>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.06em] uppercase ring-1 ring-inset ${ACTION_CLASSES[entry.action] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}
          >
            {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
          </span>
        </span>

        <span className="hidden min-w-0 flex-wrap items-baseline gap-1.5 md:flex">
          <span className="font-mono text-[10.5px] tracking-[0.05em] text-slate-400 uppercase">
            {humanizeModelName(entry.entityType)}
          </span>
          {href ? (
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[13.5px] font-medium text-slate-900 hover:underline"
            >
              {entry.entityLabel ?? entry.entityId}
            </Link>
          ) : (
            <span className="truncate text-[13.5px] font-medium text-slate-500">
              {entry.entityLabel ?? entry.entityId}
            </span>
          )}
        </span>

        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 justify-self-end stroke-slate-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          fill="none"
          strokeWidth="1.7"
        >
          <path d="M4 6.5l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="px-2.5 pt-0.5 pb-4 md:pl-[148px]">
          {/* Record name shown here too on mobile, where the row hides it. */}
          <div className="mb-2 flex items-baseline gap-1.5 md:hidden">
            <span className="font-mono text-[10.5px] tracking-[0.05em] text-slate-400 uppercase">
              {humanizeModelName(entry.entityType)}
            </span>
            {href ? (
              <Link href={href} className="text-[13.5px] font-medium text-slate-900 hover:underline">
                {entry.entityLabel ?? entry.entityId}
              </Link>
            ) : (
              <span className="text-[13.5px] font-medium text-slate-500">
                {entry.entityLabel ?? entry.entityId}
              </span>
            )}
          </div>
          <DiffTable action={entry.action as 'CREATE' | 'UPDATE' | 'DELETE'} changedFields={entry.changedFields} />
          <p className="mt-2 flex flex-wrap gap-3.5 text-xs text-slate-400">
            <span>
              <b className="font-medium text-slate-500">By:</b> {entry.userName}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

export function AuditEntryList({
  initialEntries,
  initialHasMore,
  filters,
}: {
  initialEntries: AuditEntryData[]
  initialHasMore: boolean
  filters: AuditFilters
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isPending, startTransition] = useTransition()

  function loadMore() {
    const last = entries[entries.length - 1]
    if (!last) return

    startTransition(async () => {
      const result = await loadMoreAuditEntries(
        {
          q: filters.q,
          action: filters.action,
          range: filters.range,
          from: filters.from,
          to: filters.to,
          user: filters.user,
          type: filters.type,
        },
        last.id,
      )
      setEntries((prev) => [
        ...prev,
        ...result.entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      ])
      setHasMore(result.hasMore)
    })
  }

  if (entries.length === 0) return null

  return (
    <div>
      <div className="border-t border-slate-200">
        <div className="hidden grid-cols-[132px_148px_92px_1fr_28px] gap-4 border-b border-slate-200 px-2.5 py-2 font-mono text-[10px] tracking-[0.09em] text-slate-400 uppercase md:grid">
          <span>When</span>
          <span>Who</span>
          <span>Action</span>
          <span>Record</span>
          <span />
        </div>
        {entries.map((entry) => (
          <AuditRow key={entry.id} entry={entry} />
        ))}
      </div>

      {hasMore ? (
        <div className="flex justify-center py-5">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className={buttonSecondaryClass}
          >
            {isPending ? 'Loading…' : 'Load 12 more'}
          </button>
        </div>
      ) : (
        <div className="h-10" />
      )}
    </div>
  )
}
