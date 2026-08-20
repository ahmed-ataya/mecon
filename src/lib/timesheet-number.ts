/**
 * Reference numbers for timesheets — Phase D.
 *
 * Simpler than invoice-number.ts on purpose: invoices had to reconcile a
 * pre-existing paper pad sequence with a new system sequence in the same
 * column. Timesheets have no such legacy — every one is new, so a plain
 * sequential number is enough. Equipment and operator timesheets are
 * numbered separately (own prefix, own sequence) — same "never derived from
 * each other" boundary the two models themselves keep.
 */

export const EQUIPMENT_TIMESHEET_PREFIX = 'ET-'
export const OPERATOR_TIMESHEET_PREFIX = 'OT-'

const SEQUENCE_DIGITS = 4

export function formatTimesheetNumber(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`
}

/** The next free position, given every reference number already used under this prefix. */
export function nextTimesheetSequence(prefix: string, existing: string[]): number {
  const highest = existing.reduce((max, value) => {
    if (!value.startsWith(prefix)) return max
    const parsed = Number(value.slice(prefix.length))
    return Number.isInteger(parsed) && parsed > max ? parsed : max
  }, 0)

  return highest + 1
}
