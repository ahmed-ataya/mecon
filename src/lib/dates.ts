/**
 * Date handling for date-only values (expiry dates, mobilization, assignment
 * start/end).
 *
 * Qatar runs at UTC+3. If a date-only value is ever read or written through a
 * local-timezone conversion it can shift by a day, which would silently
 * corrupt day counts in billing — the exact place a one-day error turns into
 * a wrong invoice. So every date-only value is stored as UTC midnight and
 * formatted straight from its UTC components. Nothing here touches local time.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Parse a YYYY-MM-DD form value into a UTC-midnight Date. */
export function parseDateInput(value: string): Date | null {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

/** Format a Date as YYYY-MM-DD for an <input type="date"> value. */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ''

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Display format for the whole app: 05 Aug 2026. */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'

  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** Today at UTC midnight — the reference point for every expiry calculation. */
export function todayUtc(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}

/**
 * Whole days from today until `date`. Negative means the date has passed.
 * Both sides are UTC midnight, so this is an exact integer — no rounding.
 */
export function daysUntil(date: Date): number {
  return Math.round((date.getTime() - todayUtc().getTime()) / MS_PER_DAY)
}

/** Whole days between two dates, inclusive of both ends — used for billing. */
export function inclusiveDayCount(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1
}

/**
 * The working week is Saturday to Thursday. Friday is the weekend here.
 *
 * This is not a display detail — it is the basis of every rate. A day is 10
 * hours, a week is 6 x 10 = 60, and a month is 26 x 10 = 260. Counting Fridays
 * would put the two out of step: a full July would estimate 31 x 10 = 310
 * hours on a rate that defines a month as 260.
 */
const FRIDAY = 5

export function isWorkingDay(date: Date): boolean {
  return date.getUTCDay() !== FRIDAY
}

/**
 * Working days between two dates, inclusive of both ends.
 *
 * Counted by subtracting the Fridays rather than by walking the range, so a
 * span of any length costs the same.
 */
export function workingDayCount(start: Date, end: Date): number {
  const total = inclusiveDayCount(start, end)
  if (total <= 0) return 0

  // How far the first Friday sits from the start, 0–6.
  const toFirstFriday = (FRIDAY - start.getUTCDay() + 7) % 7

  const fridays =
    toFirstFriday >= total
      ? 0
      : Math.floor((total - 1 - toFirstFriday) / 7) + 1

  return total - fridays
}

/** The day before `date`. Used when closing a replaced assignment. */
export function dayBefore(date: Date): Date {
  return new Date(date.getTime() - MS_PER_DAY)
}

/**
 * For real TIMESTAMPS (audit log entries, not the date-only values the
 * rest of this file is about) — "Today 09:21" / "Yesterday 16:48" /
 * "19 Aug 09:04", with a muted second line (the full date for
 * today/yesterday, just the year for anything older — matches how a
 * dense log reads: recent entries need the date spelled out, old ones
 * mostly need the year for orientation). Computed in UTC like everything
 * else here — a "Today" boundary that shifted per viewer's timezone would
 * make two people looking at the same row disagree about what it says.
 */
export function formatRelativeDateTime(
  date: Date,
  now: Date = new Date(),
): { relative: string; exact: string } {
  const time = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
  const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const diffDays = Math.round((dayStart(now) - dayStart(date)) / MS_PER_DAY)

  if (diffDays === 0) return { relative: `Today ${time}`, exact: formatDate(date) }
  if (diffDays === 1) return { relative: `Yesterday ${time}`, exact: formatDate(date) }

  const day = String(date.getUTCDate()).padStart(2, '0')
  return {
    relative: `${day} ${MONTHS[date.getUTCMonth()]} ${time}`,
    exact: String(date.getUTCFullYear()),
  }
}
