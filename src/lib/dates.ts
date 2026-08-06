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

/** The day before `date`. Used when closing a replaced assignment. */
export function dayBefore(date: Date): Date {
  return new Date(date.getTime() - MS_PER_DAY)
}
