'use client'

import { useMemo, useState } from 'react'
import type { ContractChoice } from './GenerateForm'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

/**
 * A calendar built here rather than the browser's.
 *
 * `min`/`max` on an <input type="date"> constrains what can be entered, but the
 * popup is drawn by the operating system and shows almost nothing about WHY a
 * day is unavailable. Picking an invoice period needs the opposite: every day
 * visibly labelled as billable, already invoiced, off hire, or outside the
 * hire — so the range can be chosen by looking instead of by memory.
 */

export type DayStatus = 'outside' | 'invoiced' | 'offhire' | 'billable'

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day))
}

function key(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function within(day: Date, start: Date, end: Date | null): boolean {
  if (day.getTime() < start.getTime()) return false
  if (end && day.getTime() > end.getTime()) return false
  return true
}

/**
 * What a given day means for the selected contracts.
 *
 * When several contracts are selected the most permissive answer wins: if any
 * one of them can bill that day, the day is billable. Anything else would grey
 * out days that are genuinely invoiceable.
 */
export function dayStatus(day: Date, contracts: ContractChoice[]): DayStatus {
  let sawCovered = false
  let sawOffHire = false

  for (const contract of contracts) {
    if (!contract.workedFrom) continue
    if (!within(day, contract.workedFrom, contract.workedTo)) continue

    sawCovered = true

    // Already on an invoice, including a draft — billing it again would
    // double-charge once both were issued.
    if (
      contract.invoicedThrough &&
      day.getTime() <= contract.invoicedThrough.getTime()
    ) {
      continue
    }

    const offHire = contract.offHire.some((period) =>
      within(day, period.startDate, period.endDate),
    )

    if (offHire) {
      sawOffHire = true
      continue
    }

    return 'billable'
  }

  if (sawOffHire) return 'offhire'
  return sawCovered ? 'invoiced' : 'outside'
}

const CELL_CLASSES: Record<DayStatus, string> = {
  // Deliberately faint and struck through: not a day you can choose.
  outside: 'text-slate-300 line-through cursor-not-allowed',
  invoiced: 'text-slate-400 bg-slate-100 cursor-not-allowed',
  offhire: 'text-red-700 bg-red-50 ring-1 ring-inset ring-red-200',
  billable: 'text-green-800 bg-green-50 ring-1 ring-inset ring-green-200',
}

export function BillingCalendar({
  contracts,
  start,
  end,
  onChange,
}: {
  contracts: ContractChoice[]
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  // Open on the first month with something to bill, so the useful month is
  // on screen without anyone navigating to it.
  const firstBillable = useMemo(() => {
    const candidates = contracts
      .map((contract) => {
        if (!contract.workedFrom) return null
        if (!contract.invoicedThrough) return contract.workedFrom
        return new Date(contract.invoicedThrough.getTime() + MS_PER_DAY)
      })
      .filter((date): date is Date => date !== null)

    if (candidates.length === 0) return new Date()
    return candidates.reduce((min, date) => (date < min ? date : min))
  }, [contracts])

  const [monthCursor, setMonthCursor] = useState(() =>
    utc(firstBillable.getUTCFullYear(), firstBillable.getUTCMonth(), 1),
  )

  const months = [
    monthCursor,
    utc(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 1),
  ]

  function pick(day: Date) {
    const iso = key(day)

    // First click sets the start; a second click after it closes the range.
    // Clicking before the current start restarts the selection there.
    if (!start || (start && end) || iso < start) {
      onChange(iso, '')
      return
    }

    onChange(start, iso)
  }

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setMonthCursor((current) =>
              utc(current.getUTCFullYear(), current.getUTCMonth() - 1, 1),
            )
          }
          className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          ← Previous
        </button>

        <span className="text-sm font-medium text-slate-700">
          {months[0].toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}{' '}
          –{' '}
          {months[1].toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </span>

        <button
          type="button"
          onClick={() =>
            setMonthCursor((current) =>
              utc(current.getUTCFullYear(), current.getUTCMonth() + 1, 1),
            )
          }
          className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
        >
          Next →
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {months.map((month) => (
          <MonthGrid
            key={key(month)}
            month={month}
            contracts={contracts}
            start={start}
            end={end}
            onPick={pick}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <Swatch className="bg-green-50 ring-1 ring-inset ring-green-200">
          Can invoice
        </Swatch>
        <Swatch className="bg-red-50 ring-1 ring-inset ring-red-200">
          Off hire — selectable, but bills nothing
        </Swatch>
        <Swatch className="bg-slate-100">Already invoiced</Swatch>
        <Swatch className="bg-white ring-1 ring-inset ring-slate-200">
          Not on hire
        </Swatch>
        <Swatch className="bg-slate-900">Selected</Swatch>
      </div>
    </div>
  )
}

function Swatch({
  className,
  children,
}: {
  className: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${className}`} />
      {children}
    </span>
  )
}

function MonthGrid({
  month,
  contracts,
  start,
  end,
  onPick,
}: {
  month: Date
  contracts: ContractChoice[]
  start: string
  end: string
  onPick: (day: Date) => void
}) {
  const year = month.getUTCFullYear()
  const monthIndex = month.getUTCMonth()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const leadingBlanks = month.getUTCDay()

  return (
    <div>
      <p className="mb-2 text-center text-xs font-medium text-slate-600">
        {month.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}
      </p>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label, index) => (
          <span
            key={index}
            className="py-1 text-center text-[10px] font-medium text-slate-400"
          >
            {label}
          </span>
        ))}

        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <span key={`blank-${index}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = utc(year, monthIndex, index + 1)
          const iso = key(day)
          const status = dayStatus(day, contracts)
          const selectable = status === 'billable' || status === 'offhire'

          const inRange =
            start && end ? iso >= start && iso <= end : false
          const isEdge = iso === start || iso === end

          return (
            <button
              key={iso}
              type="button"
              disabled={!selectable}
              onClick={() => onPick(day)}
              title={
                status === 'outside'
                  ? 'Machine was not on hire'
                  : status === 'invoiced'
                    ? 'Already on an invoice'
                    : status === 'offhire'
                      ? 'Off hire — inside the period but bills nothing'
                      : 'Can be invoiced'
              }
              className={`h-8 rounded text-xs transition ${
                isEdge
                  ? 'bg-slate-900 font-semibold text-white'
                  : inRange
                    ? // Off-hire days must stay visible INSIDE the selection —
                      // that is exactly where it matters that they bill
                      // nothing, and a plain in-range shade would hide them.
                      status === 'offhire'
                      ? 'bg-red-200 font-medium text-red-800 ring-1 ring-inset ring-red-400'
                      : 'bg-slate-900/15 text-slate-900'
                    : CELL_CLASSES[status]
              } ${selectable && !isEdge ? 'hover:ring-2 hover:ring-slate-400' : ''}`}
            >
              {index + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
