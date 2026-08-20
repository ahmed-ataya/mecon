import { isWorkingDay } from './dates'

/**
 * Shared ground between the two timesheet types — day generation and
 * defaults. The actual hours figures and overtime rules stay separate
 * (see overtime.ts, which only the operator side uses).
 */

export const EQUIPMENT_DEFAULT_HOURS_PER_DAY = 10

/**
 * Operator default when assigned to equipment — the only case this build
 * covers. The roadmap's original "8 hrs/day when not assigned" default has
 * no assignment for a timesheet to attach to in this scope (every
 * OperatorTimesheet links to a specific OperatorAssignment) — see
 * ROADMAP.md's Phase D scope note.
 */
export const OPERATOR_DEFAULT_HOURS_PER_DAY = 10

export const TIMESHEET_STATUSES = ['DRAFT', 'SIGNED'] as const
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** Every calendar month a Date range touches, most recent first — for a
 * "which month" picker that only offers months the assignment actually covers. */
export function monthsInRange(
  start: Date,
  end: Date | null,
): { year: number; month: number }[] {
  const rangeEnd = end ?? new Date()
  const months: { year: number; month: number }[] = []

  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1

  const endYear = rangeEnd.getUTCFullYear()
  const endMonth = rangeEnd.getUTCMonth() + 1

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return months.reverse()
}

/**
 * Every calendar day in `year`/`month`, clamped to an assignment's actual
 * active span — a timesheet only ever covers days the assignment was live,
 * so a machine or operator swapped mid-month gets two shorter timesheets
 * rather than one that misattributes days to the wrong assignment.
 */
export function daysInAssignmentMonth({
  year,
  month,
  assignmentStart,
  assignmentEnd,
}: {
  year: number
  month: number
  assignmentStart: Date
  assignmentEnd: Date | null
}): Date[] {
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0)) // last day of the month

  const from = assignmentStart > monthStart ? assignmentStart : monthStart
  const to =
    assignmentEnd && assignmentEnd < monthEnd ? assignmentEnd : monthEnd

  if (from > to) return []

  const days: Date[] = []
  for (
    let cursor = from;
    cursor <= to;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    days.push(cursor)
  }

  return days
}

/** 0 on Friday, the given default every other day — see dates.ts for why
 * Friday is the working-week boundary this whole app already uses. */
export function defaultHoursForDay(date: Date, defaultHours: number): number {
  return isWorkingDay(date) ? defaultHours : 0
}
