import { dayBefore, inclusiveDayCount } from './dates'
import type { LeaveType } from './enums'

/**
 * Leave entitlement, accrual, balance and pay-tier rules — Phase E2.
 *
 * Balances are COMPUTED from the full history of APPROVED leave requests,
 * never stored as a running ledger — same "status is always derived"
 * convention as document status, contract status and the timesheet overtime
 * split (see NOTES.md). A balance can never drift out of step with a
 * request that gets edited, approved late, or cancelled.
 *
 * Several conventions below are judgment calls the business hasn't
 * confirmed yet (see ROADMAP.md's open questions) — each is isolated in its
 * own constant or function so correcting it later is a one-place change:
 *   - Leave days are counted as CALENDAR days (Friday included), except a
 *     declared public holiday inside an ANNUAL leave request doesn't
 *     consume a day (Art. 79 — "leave extends by that day").
 *   - Sick leave's 3 pay tiers are tracked CUMULATIVELY across the current
 *     SERVICE YEAR (not reset per illness spell).
 *   - Emergency leave defaults to UNPAID unless a specific request is
 *     marked paid — it isn't in the statutory articles at all.
 *   - No annual leave accrues before the 1-year eligibility mark.
 */

export const ANNUAL_LEAVE_DAYS_UNDER_5Y = 21
export const ANNUAL_LEAVE_DAYS_5Y_PLUS = 28
/** Completed service years at which the entitlement steps up — Art. 79. */
export const ANNUAL_LEAVE_5Y_THRESHOLD = 5
export const ANNUAL_LEAVE_CARRY_OVER_FRACTION = 0.5

export const SICK_FULL_PAY_DAYS = 14 // 2 weeks
export const SICK_HALF_PAY_DAYS = 28 // next 4 weeks
export const SICK_HALF_PAY_CEILING = SICK_FULL_PAY_DAYS + SICK_HALF_PAY_DAYS // 42

export const HAJJ_LEAVE_DAYS = 20
export const MATERNITY_LEAVE_DAYS = 50

/**
 * Whether a leave type is paid by default, absent a per-request override.
 * SICK is excluded on purpose — its pay is always tiered day by day, never
 * a flat yes/no (see sickLeavePayTiers below).
 */
export const LEAVE_TYPE_DEFAULT_PAID: Record<Exclude<LeaveType, 'SICK'>, boolean> = {
  ANNUAL: true,
  MATERNITY: true,
  PUBLIC_HOLIDAY: true,
  UNPAID: false,
  HAJJ: false, // statutory Hajj leave is unpaid
  EMERGENCY: false, // not statutory — a company benefit, pending the business's own policy
}

function addYearsUtc(date: Date, years: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()),
  )
}

export function isEligibleForAnnualLeave(
  dateOfJoining: Date | null,
  asOfDate: Date,
): boolean {
  if (!dateOfJoining) return false
  return asOfDate >= addYearsUtc(dateOfJoining, 1)
}

/**
 * Which service year (0-based) `asOfDate` falls in, and that year's
 * [start, end) bounds — end is exclusive, the next join-date anniversary.
 * Year 0 is the pre-eligibility year; year 1 is the first year leave can
 * actually be taken in.
 */
export function serviceYearAt(
  dateOfJoining: Date,
  asOfDate: Date,
): { index: number; start: Date; end: Date } {
  let index = 0
  while (addYearsUtc(dateOfJoining, index + 1) <= asOfDate) index += 1
  return {
    index,
    start: addYearsUtc(dateOfJoining, index),
    end: addYearsUtc(dateOfJoining, index + 1),
  }
}

/** 21 days under 5 completed years' service, 28 at 5+ — Art. 79. */
export function statutoryAnnualEntitlementDays(serviceYearIndex: number): number {
  return serviceYearIndex >= ANNUAL_LEAVE_5Y_THRESHOLD
    ? ANNUAL_LEAVE_DAYS_5Y_PLUS
    : ANNUAL_LEAVE_DAYS_UNDER_5Y
}

/**
 * Calendar days a leave request spans, inclusive — the unit entitlement and
 * balance are tracked in. A public holiday landing inside an ANNUAL request
 * doesn't consume a day (Art. 79); every other leave type counts every
 * calendar day in range, Friday included. See the module comment for why
 * this specific counting convention is a judgment call, not a confirmed
 * business rule.
 */
export function leaveDaysConsumed(
  leaveType: LeaveType,
  startDate: Date,
  endDate: Date,
  publicHolidays: { startDate: Date; endDate: Date }[],
): number {
  const total = inclusiveDayCount(startDate, endDate)
  if (leaveType !== 'ANNUAL' || publicHolidays.length === 0) return total

  let holidayDays = 0
  for (
    let cursor = startDate;
    cursor <= endDate;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    if (publicHolidays.some((h) => cursor >= h.startDate && cursor <= h.endDate)) {
      holidayDays += 1
    }
  }
  return total - holidayDays
}

export type AnnualLeaveBalance = {
  eligible: boolean
  serviceYearIndex: number | null
  entitlementDaysThisYear: number
  carriedInDays: number
  takenDaysThisYear: number
  balanceDays: number
}

const ZERO_BALANCE: AnnualLeaveBalance = {
  eligible: false,
  serviceYearIndex: null,
  entitlementDaysThisYear: 0,
  carriedInDays: 0,
  takenDaysThisYear: 0,
  balanceDays: 0,
}

/**
 * Walks every completed service year from joining to `asOfDate`, carrying
 * forward up to half of each year's unused entitlement into the next (Art.
 * 79), then returns the still-open current year's prorated entitlement plus
 * that carry-in, minus APPROVED annual leave already booked this year
 * (past or still upcoming — an approved future request already earmarks
 * those days).
 */
export function computeAnnualLeaveBalance({
  dateOfJoining,
  entitlementOverrideDays,
  approvedAnnualLeaveRequests,
  publicHolidays,
  asOfDate,
}: {
  dateOfJoining: Date | null
  entitlementOverrideDays: number | null
  approvedAnnualLeaveRequests: { startDate: Date; endDate: Date }[]
  publicHolidays: { startDate: Date; endDate: Date }[]
  asOfDate: Date
}): AnnualLeaveBalance {
  if (!dateOfJoining || !isEligibleForAnnualLeave(dateOfJoining, asOfDate)) {
    return ZERO_BALANCE
  }

  const current = serviceYearAt(dateOfJoining, asOfDate)

  function takenInYear(start: Date, end: Date): number {
    return approvedAnnualLeaveRequests
      .filter((r) => r.startDate >= start && r.startDate < end)
      .reduce(
        (sum, r) => sum + leaveDaysConsumed('ANNUAL', r.startDate, r.endDate, publicHolidays),
        0,
      )
  }

  let carry = 0
  // Years 1..current.index-1 are fully completed — walk them to build up
  // the carry-over. Year 0 never accrues (pre-eligibility), so carry into
  // year 1 always starts at zero.
  for (let index = 1; index < current.index; index++) {
    const start = addYearsUtc(dateOfJoining, index)
    const end = addYearsUtc(dateOfJoining, index + 1)
    const entitlement = entitlementOverrideDays ?? statutoryAnnualEntitlementDays(index)
    const closingBalance = entitlement + carry - takenInYear(start, end)
    carry = Math.max(0, Math.min(closingBalance, entitlement * ANNUAL_LEAVE_CARRY_OVER_FRACTION))
  }

  const entitlementFull =
    entitlementOverrideDays ?? statutoryAnnualEntitlementDays(current.index)
  const carriedIn = current.index === 0 ? 0 : carry

  const elapsedDays = inclusiveDayCount(current.start, asOfDate)
  const totalDaysInYear = inclusiveDayCount(current.start, dayBefore(current.end))
  const entitlementThisYear =
    Math.round(entitlementFull * Math.min(elapsedDays / totalDaysInYear, 1) * 100) / 100

  const takenThisYear = takenInYear(current.start, current.end)
  const balanceDays = entitlementThisYear + carriedIn - takenThisYear

  return {
    eligible: true,
    serviceYearIndex: current.index,
    entitlementDaysThisYear: entitlementThisYear,
    carriedInDays: carriedIn,
    takenDaysThisYear: takenThisYear,
    balanceDays,
  }
}

export type SickPayTierBreakdown = {
  fullPayDays: number
  halfPayDays: number
  unpaidDays: number
}

/**
 * Splits a SICK request's days across the 3 statutory pay tiers (Art. 82)
 * by walking their cumulative position in the current service year.
 * `priorSickDaysThisServiceYear` is how many sick days this employee
 * already had APPROVED earlier in the same service year — so a second
 * illness later in the year continues the count rather than resetting it.
 */
export function sickLeavePayTiers(
  priorSickDaysThisServiceYear: number,
  requestedDays: number,
): SickPayTierBreakdown {
  let fullPayDays = 0
  let halfPayDays = 0
  let unpaidDays = 0

  for (let i = 1; i <= requestedDays; i++) {
    const cumulativeDay = priorSickDaysThisServiceYear + i
    if (cumulativeDay <= SICK_FULL_PAY_DAYS) fullPayDays += 1
    else if (cumulativeDay <= SICK_HALF_PAY_CEILING) halfPayDays += 1
    else unpaidDays += 1
  }

  return { fullPayDays, halfPayDays, unpaidDays }
}

/** How many days of SICK leave this employee already had APPROVED earlier
 * in the service year containing `before` — the running count sickLeavePayTiers
 * and resolveLeaveDaysInRange both need to keep tiering continuous across a
 * request or a payroll period boundary. */
export function countApprovedSickDaysBefore({
  dateOfJoining,
  approvedSickRequests,
  before,
}: {
  dateOfJoining: Date | null
  approvedSickRequests: { startDate: Date; endDate: Date }[]
  before: Date
}): number {
  if (!dateOfJoining) return 0

  const { start } = serviceYearAt(dateOfJoining, before)

  return approvedSickRequests
    .filter((r) => r.startDate >= start && r.startDate < before)
    .reduce((sum, r) => {
      const clippedEnd = r.endDate < before ? r.endDate : dayBefore(before)
      return sum + Math.max(0, inclusiveDayCount(r.startDate, clippedEnd))
    }, 0)
}

export type ResolvedLeaveDay = {
  date: Date
  dayType: 'LEAVE' | 'PUBLIC_HOLIDAY'
  leaveType: LeaveType
  /** 1 = full pay, 0.5 = half pay, 0 = unpaid — how much of a standard
   * day's pay this day carries. */
  payFraction: number
}

/**
 * Resolves every day in [rangeStart, rangeEnd] covered by an APPROVED leave
 * request or a declared public holiday, for one employee. A public holiday
 * takes priority over a coinciding leave request — the holiday, not the
 * personal leave, explains the day. Used both to default a new operator
 * timesheet's day types (src/lib/actions/timesheets.ts) and to compute
 * payroll's paid/unpaid leave hours (src/lib/actions/payroll.ts) — the same
 * resolution feeds both, so a timesheet's leave label and payroll's
 * deduction can never disagree about what a day was.
 */
export function resolveLeaveDaysInRange({
  rangeStart,
  rangeEnd,
  approvedRequests,
  publicHolidays,
  priorSickDaysThisServiceYear,
}: {
  rangeStart: Date
  rangeEnd: Date
  approvedRequests: {
    leaveType: LeaveType
    startDate: Date
    endDate: Date
    paidOverride: boolean | null
  }[]
  publicHolidays: { startDate: Date; endDate: Date }[]
  priorSickDaysThisServiceYear: number
}): ResolvedLeaveDay[] {
  const results: ResolvedLeaveDay[] = []
  let sickCount = priorSickDaysThisServiceYear

  for (
    let cursor = rangeStart;
    cursor <= rangeEnd;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const holiday = publicHolidays.find(
      (h) => cursor >= h.startDate && cursor <= h.endDate,
    )
    if (holiday) {
      results.push({ date: cursor, dayType: 'PUBLIC_HOLIDAY', leaveType: 'PUBLIC_HOLIDAY', payFraction: 1 })
      continue
    }

    const request = approvedRequests.find(
      (r) => cursor >= r.startDate && cursor <= r.endDate,
    )
    if (!request) continue

    let payFraction: number
    if (request.leaveType === 'SICK') {
      sickCount += 1
      payFraction =
        sickCount <= SICK_FULL_PAY_DAYS ? 1 : sickCount <= SICK_HALF_PAY_CEILING ? 0.5 : 0
    } else if (request.paidOverride !== null && request.paidOverride !== undefined) {
      payFraction = request.paidOverride ? 1 : 0
    } else {
      payFraction = LEAVE_TYPE_DEFAULT_PAID[request.leaveType as Exclude<LeaveType, 'SICK'>]
        ? 1
        : 0
    }

    results.push({ date: cursor, dayType: 'LEAVE', leaveType: request.leaveType, payFraction })
  }

  return results
}
