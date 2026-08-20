'use client'

import { useActionState, useState } from 'react'
import { splitOvertimeHours } from '@/lib/overtime'
import type { UpdateDaysActionState } from '@/lib/actions/timesheets'
import { FormError, buttonPrimaryClass } from '@/components/ui/form'

export type DailyRow = {
  id: string
  date: string // YYYY-MM-DD
  startTime: string | null
  endTime: string | null
  workingHours: number
  breakdownHours: number
  remarks: string | null
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function dayLabel(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`)
  return {
    dayName: DAY_NAMES[date.getUTCDay()],
    dayNumber: date.getUTCDate(),
    isFriday: date.getUTCDay() === 5,
  }
}

const cellInputClass =
  'w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-400'

/**
 * One editable table for a whole month's daily rows. Shared by both
 * timesheet types — `showOvertimeSplit` is the only thing that changes,
 * since regular/overtime only ever applies to operator (payroll) hours,
 * never to equipment (invoicing) hours.
 *
 * Submitted as one bulk form rather than 30 individual saves — matches how
 * a real timesheet is signed off as one document, not row by row.
 */
export function DailyRowsTable({
  days,
  action,
  showOvertimeSplit,
  readOnly,
}: {
  days: DailyRow[]
  action: (
    state: UpdateDaysActionState,
    formData: FormData,
  ) => Promise<UpdateDaysActionState>
  showOvertimeSplit: boolean
  readOnly: boolean
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  const [rows, setRows] = useState(days)

  function updateRow(id: string, patch: Partial<DailyRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }

  const totalWorking = rows.reduce((sum, row) => sum + row.workingHours, 0)
  const totalBreakdown = rows.reduce((sum, row) => sum + row.breakdownHours, 0)
  const totalRegular = rows.reduce(
    (sum, row) => sum + splitOvertimeHours(row.workingHours).regularHours,
    0,
  )
  const totalOvertime = rows.reduce(
    (sum, row) => sum + splitOvertimeHours(row.workingHours).overtimeHours,
    0,
  )
  const flaggedDays = rows.filter(
    (row) => splitOvertimeHours(row.workingHours).exceedsLegalCap,
  )

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={errors.form} />

      {showOvertimeSplit && flaggedDays.length > 0 && (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          <p className="font-medium">
            {flaggedDays.length} day{flaggedDays.length === 1 ? '' : 's'} over
            the 10-hour statutory cap
          </p>
          <p className="mt-1 text-xs opacity-90">
            Overtime is capped at 2 hrs/day by law except emergencies. These
            hours are recorded but not automatically paid past the cap —
            confirm the reason before signing.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Start</th>
              <th className="px-2 py-2 font-medium">Finish</th>
              <th className="px-2 py-2 font-medium">Working hrs</th>
              <th className="px-2 py-2 font-medium">Breakdown hrs</th>
              {showOvertimeSplit && (
                <>
                  <th className="px-2 py-2 font-medium">Regular</th>
                  <th className="px-2 py-2 font-medium">OT</th>
                </>
              )}
              <th className="px-2 py-2 font-medium">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const { dayName, dayNumber, isFriday } = dayLabel(row.date)
              const split = splitOvertimeHours(row.workingHours)

              return (
                <tr key={row.id} className={isFriday ? 'bg-slate-50' : undefined}>
                  <input type="hidden" name="dayId" value={row.id} />
                  <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                    {dayName} {String(dayNumber).padStart(2, '0')}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      name="startTime"
                      defaultValue={row.startTime ?? ''}
                      disabled={readOnly}
                      placeholder="06:00"
                      className={cellInputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      name="endTime"
                      defaultValue={row.endTime ?? ''}
                      disabled={readOnly}
                      placeholder="17:00"
                      className={cellInputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      name="workingHours"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={row.workingHours}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateRow(row.id, {
                          workingHours: Number(event.target.value) || 0,
                        })
                      }
                      className={`${cellInputClass} ${
                        split.exceedsLegalCap ? 'border-amber-400 bg-amber-50' : ''
                      }`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      name="breakdownHours"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={row.breakdownHours}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateRow(row.id, {
                          breakdownHours: Number(event.target.value) || 0,
                        })
                      }
                      className={cellInputClass}
                    />
                  </td>
                  {showOvertimeSplit && (
                    <>
                      <td className="px-2 py-1.5 text-slate-600">
                        {split.regularHours}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">
                        {split.overtimeHours}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-1.5">
                    <input
                      name="remarks"
                      defaultValue={row.remarks ?? ''}
                      disabled={readOnly}
                      className={cellInputClass}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 font-medium text-slate-700">
            <tr>
              <td className="px-2 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-2 py-2">{totalWorking}</td>
              <td className="px-2 py-2">{totalBreakdown}</td>
              {showOvertimeSplit && (
                <>
                  <td className="px-2 py-2">{totalRegular}</td>
                  <td className="px-2 py-2">{totalOvertime}</td>
                </>
              )}
              <td className="px-2 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </form>
  )
}
