/**
 * Statutory overtime split for one day's OPERATOR hours — confirmed
 * directly with the user, not assumed, 2026-08-18:
 *
 *   0-8h    regular basic hourly rate
 *   8-10h   125% of regular basic hourly rate
 *   <8h     paid at actual hours worked, no overtime
 *   >10h    flagged, never silently paid — statutory overtime is capped at
 *           2h/day except emergencies, which is a human judgement call this
 *           function does not make
 *
 * EQUIPMENT timesheets never go through this — they drive invoicing at the
 * contractual rate, which has no overtime concept. This is payroll-only.
 *
 * Computed from workingHours every time it's read, never stored — same
 * "one source of truth" pattern as getDocumentStatus and profile
 * completeness elsewhere in this app, so an edited hour figure can never
 * leave a stale split behind.
 */

export const REGULAR_HOURS_CAP = 8
export const OVERTIME_HOURS_CAP = 2
export const MAX_LEGAL_DAILY_HOURS = REGULAR_HOURS_CAP + OVERTIME_HOURS_CAP

export type OvertimeSplit = {
  regularHours: number
  overtimeHours: number
  /** workingHours exceeded the statutory 10h/day cap — needs a human to
   * confirm it was a genuine emergency exception, never auto-paid. */
  exceedsLegalCap: boolean
}

export function splitOvertimeHours(workingHours: number): OvertimeSplit {
  const regularHours = Math.min(workingHours, REGULAR_HOURS_CAP)
  const overtimeHours = Math.min(
    Math.max(workingHours - REGULAR_HOURS_CAP, 0),
    OVERTIME_HOURS_CAP,
  )

  return {
    regularHours,
    overtimeHours,
    exceedsLegalCap: workingHours > MAX_LEGAL_DAILY_HOURS,
  }
}
