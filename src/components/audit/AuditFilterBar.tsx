'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { humanizeModelName } from '@/lib/audit-model'
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
} from '@/lib/audit-model'
import type { AuditFilters } from '@/lib/audit-queries'
import { SearchInput } from '@/components/ui/SearchInput'

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: 'ALL', label: 'All time' },
  { value: 'custom', label: 'Custom range…' },
]

/**
 * Every control here reads and writes the URL's own query params — the
 * whole point being a filtered view is shareable and survives a refresh.
 * Plain native `<select>`s with onChange navigation, not this app's
 * custom Select component: that one exists to survive a Server Action's
 * form-reset lifecycle (see its own comment), which doesn't apply here —
 * nothing is ever submitted, each change just pushes a new URL.
 */
export function AuditFilterBar({
  filters,
  users,
  types,
  dirty,
}: {
  filters: AuditFilters
  users: string[]
  types: string[]
  dirty: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [customFrom, setCustomFrom] = useState(filters.from)
  const [customTo, setCustomTo] = useState(filters.to)

  function setParam(key: string, value: string, extra?: Record<string, string>) {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'ALL') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function applyCustomRange() {
    setParam('range', 'custom', { from: customFrom, to: customTo })
  }

  return (
    <div className="sticky top-0 z-[5] space-y-2.5 border-y border-slate-200 bg-white/95 py-2.5 backdrop-blur-sm md:top-[49px] md:bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[280px] min-w-[190px] flex-1">
          <SearchInput placeholder="Search records…" />
        </div>

        <div
          role="group"
          aria-label="Filter by action"
          className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white"
        >
          <button
            type="button"
            aria-pressed={filters.action === 'ALL'}
            onClick={() => setParam('action', 'ALL')}
            className={`border-r border-slate-200 px-2.5 py-1.5 text-xs ${
              filters.action === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            All
          </button>
          {AUDIT_ACTIONS.map((action, i) => (
            <button
              key={action}
              type="button"
              aria-pressed={filters.action === action}
              onClick={() => setParam('action', action)}
              className={`px-2.5 py-1.5 text-xs ${i < AUDIT_ACTIONS.length - 1 ? 'border-r border-slate-200' : ''} ${
                filters.action === action
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {AUDIT_ACTION_LABELS[action]}
            </button>
          ))}
        </div>

        <select
          aria-label="Date range"
          value={filters.range}
          onChange={(e) => {
            if (e.target.value === 'custom') {
              setParam('range', 'custom')
            } else {
              setParam('range', e.target.value, { from: '', to: '' })
            }
          }}
          className="rounded-md border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by user"
          value={filters.user}
          onChange={(e) => setParam('user', e.target.value)}
          className="rounded-md border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700"
        >
          <option value="ALL">Anyone</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by record type"
          value={filters.type}
          onChange={(e) => setParam('type', e.target.value)}
          className="rounded-md border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700"
        >
          <option value="ALL">All records</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {humanizeModelName(t)}
            </option>
          ))}
        </select>

        {dirty && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="px-1 py-1.5 text-xs text-slate-400 underline hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {filters.range === 'custom' && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <label htmlFor="audit-from">From</label>
          <input
            id="audit-from"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
          <label htmlFor="audit-to">to</label>
          <input
            id="audit-to"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={applyCustomRange}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
