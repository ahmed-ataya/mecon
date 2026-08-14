import { workingDayCount } from './dates'
import { HOURS_PER_WORKING_DAY } from './enums'

/**
 * THE ONE PLACE HOURS COME FROM.
 *
 * Everything downstream — the invoice line, the amount, the rate audit —
 * asks this module and nothing else. That is the point: hours are currently an
 * estimate derived from the calendar, and they will shortly come from
 * timesheets instead. When that happens only `hoursFor` changes body, and the
 * invoice generator, the audit and the printed form are untouched.
 *
 * Two things travel with the number so nobody downstream has to guess:
 *
 *  - `source` says whether it was measured or inferred. An estimated invoice
 *    and a verified one must never look alike, on screen or on paper.
 *  - `billableDays` is the duration the hours were derived from, which is what
 *    the rate audit compares against the quoted period.
 */

export const HOURS_SOURCES = ['ESTIMATE', 'TIMESHEET'] as const
export type HoursSource = (typeof HOURS_SOURCES)[number]

export const HOURS_SOURCE_LABELS: Record<HoursSource, string> = {
  ESTIMATE: 'Estimated',
  TIMESHEET: 'From timesheet',
}

export type OffHireLike = {
  startDate: Date
  endDate: Date | null
}

export type Span = { from: Date; to: Date; days: number }

export type SpanHours = {
  hours: number
  source: HoursSource
  /** Working days on hire after off-hire is deducted. */
  billableDays: number
  /** Working days lost to off hire, so the deduction can be shown not hidden. */
  offHireDays: number
  from: Date
  to: Date
}

/**
 * Working days two ranges share, inclusive at both ends. Null if they miss.
 *
 * WORKING days — Saturday to Thursday — because that is what every rate is
 * built on. Fridays are not billable days, so a hire spanning one is not a day
 * longer for it.
 */
export function overlapSpan(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date,
): Span | null {
  const from = aStart.getTime() > bStart.getTime() ? aStart : bStart
  const aFinish = aEnd ?? bEnd
  const to = aFinish.getTime() < bEnd.getTime() ? aFinish : bEnd

  if (from.getTime() > to.getTime()) return null

  return { from, to, days: workingDayCount(from, to) }
}

/** Also working days, so the deduction is in the same unit as the hire. */
export function offHireWorkingDays(
  offHires: OffHireLike[],
  from: Date,
  to: Date,
): number {
  let days = 0

  for (const offHire of offHires) {
    const overlap = overlapSpan(offHire.startDate, offHire.endDate, from, to)
    if (overlap) days += overlap.days
  }

  return days
}

/**
 * Hours for one machine over one span.
 *
 * TODAY this is an estimate: working days on hire, less off hire, times ten.
 * It is only ever a starting point — a 23-day hire was really invoiced as
 * 162.5 hours, not 190, because the machine did not work every hour of every
 * day. The calendar cannot know that; a timesheet can.
 *
 * WHEN TIMESHEETS ARRIVE this function looks for recorded hours over the span
 * and returns them with source 'TIMESHEET', falling back to the estimate for
 * any span not yet entered. Nothing else in the system needs to change.
 */
export function hoursFor({
  assignmentStart,
  assignmentEnd,
  offHirePeriods,
  period,
}: {
  assignmentStart: Date
  assignmentEnd: Date | null
  offHirePeriods: OffHireLike[]
  period: { start: Date; end: Date }
}): SpanHours | null {
  const overlap = overlapSpan(
    assignmentStart,
    assignmentEnd,
    period.start,
    period.end,
  )
  if (!overlap) return null

  const offHireDays = offHireWorkingDays(offHirePeriods, overlap.from, overlap.to)
  const billableDays = Math.max(0, overlap.days - offHireDays)

  return {
    hours: billableDays * HOURS_PER_WORKING_DAY,
    source: 'ESTIMATE',
    billableDays,
    offHireDays,
    from: overlap.from,
    to: overlap.to,
  }
}
