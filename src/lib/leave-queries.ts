import { db } from './db'
import {
  computeAnnualLeaveBalance,
  countApprovedSickDaysBefore,
  type AnnualLeaveBalance,
} from './leave'
import type { LeaveType } from './enums'
import { todayUtc } from './dates'

export async function loadLeaveRequests() {
  return db.leaveRequest.findMany({
    include: { employee: true },
    orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
  })
}

export async function loadLeaveRequest(id: string) {
  return db.leaveRequest.findUnique({
    where: { id },
    include: { employee: true },
  })
}

export async function loadPublicHolidays() {
  return db.publicHoliday.findMany({ orderBy: { startDate: 'desc' } })
}

/** Every employee, for the "request leave" picker — same shape the
 * timesheet assignment pickers use for their own dropdowns. */
export async function loadEmployeeOptions() {
  const employees = await db.employee.findMany({
    select: { id: true, name: true, employeeNumber: true, category: true },
    orderBy: { name: 'asc' },
  })

  return employees.map((e) => ({
    id: e.id,
    label: e.employeeNumber ? `${e.name} (${e.employeeNumber})` : e.name,
    category: e.category,
  }))
}

/** One employee's annual leave balance plus their full request history —
 * for the employee detail page's Leave section. */
export async function loadEmployeeLeaveSummary(employeeId: string) {
  const [employee, requests, publicHolidays] = await Promise.all([
    db.employee.findUnique({
      where: { id: employeeId },
      select: { dateOfJoining: true, annualLeaveEntitlementOverrideDays: true },
    }),
    db.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    }),
    db.publicHoliday.findMany(),
  ])

  if (!employee) return null

  const asOfDate = todayUtc()

  const approvedAnnual = requests.filter(
    (r) => r.leaveType === 'ANNUAL' && r.status === 'APPROVED',
  )

  const balance: AnnualLeaveBalance = computeAnnualLeaveBalance({
    dateOfJoining: employee.dateOfJoining,
    entitlementOverrideDays: employee.annualLeaveEntitlementOverrideDays,
    approvedAnnualLeaveRequests: approvedAnnual,
    publicHolidays,
    asOfDate,
  })

  const approvedSickThisServiceYear = countApprovedSickDaysBefore({
    dateOfJoining: employee.dateOfJoining,
    approvedSickRequests: requests.filter(
      (r) => r.leaveType === 'SICK' && r.status === 'APPROVED',
    ),
    // "Before" a day after today, so today's own sick days (if any) count too.
    before: new Date(asOfDate.getTime() + 24 * 60 * 60 * 1000),
  })

  const isOnApprovedLeaveToday = requests.some(
    (r) =>
      r.status === 'APPROVED' &&
      r.startDate <= asOfDate &&
      r.endDate >= asOfDate,
  )

  return { requests, balance, approvedSickThisServiceYear, isOnApprovedLeaveToday }
}

export type CalendarEntry = {
  id: string
  employeeId: string
  employeeName: string
  category: string
  siteName: string | null
  leaveType: LeaveType
  status: string
  startDate: Date
  endDate: Date
}

/** Every leave request overlapping a calendar month, with each employee's
 * CURRENT site (their active operator assignment's contract, if any) —
 * "site" for a non-operator, or an operator between contracts, is null. */
export async function loadLeaveCalendar({
  year,
  month,
}: {
  year: number
  month: number
}): Promise<CalendarEntry[]> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))

  const requests = await db.leaveRequest.findMany({
    where: {
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
    include: {
      employee: {
        include: {
          assignments: {
            where: { endDate: null },
            include: { contract: { select: { siteName: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  return requests.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    category: r.employee.category,
    siteName: r.employee.assignments[0]?.contract.siteName ?? null,
    leaveType: r.leaveType as LeaveType,
    status: r.status,
    startDate: r.startDate,
    endDate: r.endDate,
  }))
}
