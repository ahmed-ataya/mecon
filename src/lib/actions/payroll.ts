'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { todayUtc } from '../dates'
import { splitOvertimeHours } from '../overtime'
import { computePayslip, standardHoursForDate, standardHoursForMonth } from '../payroll'
import { countApprovedSickDaysBefore, resolveLeaveDaysInRange } from '../leave'
import type { LeaveType } from '../enums'
import { formatTimesheetNumber, nextTimesheetSequence } from '../timesheet-number'
import { monthLabel } from '../timesheet'
import { fieldErrors, payrollPeriodCreateSchema } from '../validation'
import { requirePayrollAccess } from '../auth/guard'
import { createdField, diffField, fmt, type FieldChange, logAudit } from '../audit'

/** Reuses the generic sequential-numbering helper Phase D built — the name
 * is a historical accident (it was written for timesheets first), the logic
 * itself is just "prefix + next free number", equally valid here. */
const PAYSLIP_PREFIX = 'PS-'

export type CreatePeriodActionState = {
  errors?: Record<string, string>
  values?: { year: string; month: string }
}

export type UpdatePayslipActionState = {
  errors?: Record<string, string>
  ok?: boolean
}

/**
 * One employee's hours for a period — real, signed data where it exists,
 * an editable estimate otherwise. This is what makes payroll cover the
 * WHOLE workforce rather than just contract-linked operators (see
 * ROADMAP.md's Phase E3 scope note): every employee gets a payslip, only
 * the hours' source differs.
 *
 * paidLeaveHours/unpaidLeaveHours (Phase E2) are computed identically for
 * both sources from the employee's own APPROVED leave requests — never from
 * the timesheet's day types, which only exist for display (see
 * OperatorTimesheetDay's model comment). For an ESTIMATE employee they
 * reduce the assumed-full-attendance regularHours; for a TIMESHEET employee
 * a genuine leave day already shows 0 worked hours, so regularHours needs
 * no adjustment — the leave hours are simply added alongside it.
 */
function resolveHours(
  standardHours: number,
  signedDays: { workingHours: number }[],
  paidLeaveHours: number,
  unpaidLeaveHours: number,
): { hoursSource: string; regularHours: number; overtimeHours: number } {
  if (signedDays.length === 0) {
    const regularHours = Math.max(0, standardHours - paidLeaveHours - unpaidLeaveHours)
    return { hoursSource: 'ESTIMATE', regularHours, overtimeHours: 0 }
  }

  let regularHours = 0
  let overtimeHours = 0
  for (const day of signedDays) {
    const split = splitOvertimeHours(day.workingHours)
    regularHours += split.regularHours
    overtimeHours += split.overtimeHours
  }

  return { hoursSource: 'TIMESHEET', regularHours, overtimeHours }
}

/**
 * This employee's approved leave for one payroll month, converted to
 * paid/unpaid hours — Phase E2. Shared by generation and re-pull so both
 * paths compute it identically. See src/lib/leave.ts's resolveLeaveDaysInRange
 * for why a public holiday and sick leave's pay tiers are handled the way
 * they are.
 */
async function leaveHoursForEmployeePeriod(
  employee: { id: string; dateOfJoining: Date | null },
  year: number,
  month: number,
  ramadanPeriods: { startDate: Date; endDate: Date }[],
): Promise<{ paidLeaveHours: number; unpaidLeaveHours: number }> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))

  const [approvedRequests, publicHolidays, priorSickRequests] = await Promise.all([
    db.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    }),
    db.publicHoliday.findMany({
      where: { startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
    }),
    db.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: 'APPROVED',
        leaveType: 'SICK',
        startDate: { lt: monthStart },
      },
      select: { startDate: true, endDate: true },
    }),
  ])

  const priorSickDaysThisServiceYear = countApprovedSickDaysBefore({
    dateOfJoining: employee.dateOfJoining,
    approvedSickRequests: priorSickRequests,
    before: monthStart,
  })

  const resolvedDays = resolveLeaveDaysInRange({
    rangeStart: monthStart,
    rangeEnd: monthEnd,
    approvedRequests: approvedRequests.map((r) => ({
      leaveType: r.leaveType as LeaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      paidOverride: r.paidOverride,
    })),
    publicHolidays,
    priorSickDaysThisServiceYear,
  })

  let paidLeaveHours = 0
  let unpaidLeaveHours = 0
  for (const day of resolvedDays) {
    const hours = standardHoursForDate(day.date, ramadanPeriods)
    paidLeaveHours += hours * day.payFraction
    unpaidLeaveHours += hours * (1 - day.payFraction)
  }

  return { paidLeaveHours, unpaidLeaveHours }
}

/**
 * Generates one payslip per employee who has a basic salary set — everyone
 * else is skipped (never zero-filled), since a payslip with no basic
 * salary would be meaningless. Returns how many of each so the caller can
 * tell the office what happened.
 */
async function generatePayslips(
  payrollPeriodId: string,
  year: number,
  month: number,
): Promise<{ created: number; skipped: number }> {
  const [employees, ramadanPeriods, assignments, existing] = await Promise.all([
    db.employee.findMany({ where: { basicSalary: { not: null } } }),
    db.ramadanPeriod.findMany(),
    db.operatorAssignment.findMany({
      where: { operatorId: { not: null } },
      select: {
        operatorId: true,
        timesheets: {
          where: { year, month, status: 'SIGNED' },
          include: { days: { select: { workingHours: true } } },
        },
      },
    }),
    db.payslip.findMany({ select: { referenceNumber: true } }),
  ])

  const standardHours = standardHoursForMonth({
    year,
    month,
    ramadanPeriods: ramadanPeriods.map((period) => ({
      startDate: period.startDate,
      endDate: period.endDate,
    })),
  })

  // Every signed day, across every assignment, grouped by employee — an
  // employee can hold more than one operator assignment if they changed
  // contracts mid-month, and every one of them counts.
  const signedDaysByEmployee = new Map<string, { workingHours: number }[]>()
  for (const assignment of assignments) {
    if (!assignment.operatorId) continue
    const days = assignment.timesheets.flatMap((ts) => ts.days)
    if (days.length === 0) continue

    const existingDays = signedDaysByEmployee.get(assignment.operatorId) ?? []
    signedDaysByEmployee.set(assignment.operatorId, [...existingDays, ...days])
  }

  let sequence = nextTimesheetSequence(
    PAYSLIP_PREFIX,
    existing.map((row) => row.referenceNumber),
  )

  const totalEmployees = await db.employee.count()
  let created = 0

  for (const employee of employees) {
    const { paidLeaveHours, unpaidLeaveHours } = await leaveHoursForEmployeePeriod(
      employee,
      year,
      month,
      ramadanPeriods,
    )

    const { hoursSource, regularHours, overtimeHours } = resolveHours(
      standardHours,
      signedDaysByEmployee.get(employee.id) ?? [],
      paidLeaveHours,
      unpaidLeaveHours,
    )

    const calc = computePayslip({
      basicSalary: employee.basicSalary!,
      housingAllowance: employee.housingAllowance ?? 0,
      transportAllowance: employee.transportAllowance ?? 0,
      foodAllowance: employee.foodAllowance ?? 0,
      siteAllowance: employee.siteAllowance ?? 0,
      otherAllowance: employee.otherAllowance ?? 0,
      standardHours,
      regularHours,
      overtimeHours,
      paidLeaveHours,
      unpaidLeaveHours,
      deductionsAmount: 0,
    })

    await db.payslip.create({
      data: {
        referenceNumber: formatTimesheetNumber(PAYSLIP_PREFIX, sequence),
        payrollPeriodId,
        employeeId: employee.id,
        basicSalary: employee.basicSalary!,
        housingAllowance: employee.housingAllowance ?? 0,
        transportAllowance: employee.transportAllowance ?? 0,
        foodAllowance: employee.foodAllowance ?? 0,
        siteAllowance: employee.siteAllowance ?? 0,
        otherAllowance: employee.otherAllowance ?? 0,
        hoursSource,
        standardHours,
        regularHours,
        overtimeHours,
        paidLeaveHours,
        unpaidLeaveHours,
        shortfallDeduction: calc.shortfallDeduction,
        overtimePay: calc.overtimePay,
        grossPay: calc.grossPay,
        netPay: calc.netPay,
      },
    })

    sequence += 1
    created += 1
  }

  return { created, skipped: totalEmployees - created }
}

export async function createPayrollPeriod(
  _prev: CreatePeriodActionState,
  formData: FormData,
): Promise<CreatePeriodActionState> {
  const user = await requirePayrollAccess()

  const values = {
    year: String(formData.get('year') ?? ''),
    month: String(formData.get('month') ?? ''),
  }
  const parsed = payrollPeriodCreateSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const { year, month } = parsed.data

  const existing = await db.payrollPeriod.findUnique({
    where: { year_month: { year, month } },
  })

  if (existing) {
    return {
      errors: { form: `A payroll period for ${month}/${year} already exists.` },
      values,
    }
  }

  const period = await db.payrollPeriod.create({ data: { year, month } })

  const { created } = await generatePayslips(period.id, year, month)

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'PayrollPeriod',
    entityId: period.id,
    entityLabel: `${month}/${year}`,
    changedFields: [
      createdField('Period', monthLabel(year, month)),
      createdField('Payslips generated', created, (n) => String(n)),
    ],
  })

  revalidatePath('/payroll')
  redirect(`/payroll/${period.id}`)
}

/** Re-pulls one employee's hours — useful when a timesheet gets signed
 * after the payroll period was first generated. */
export async function regeneratePayslip(payslipId: string) {
  const user = await requirePayrollAccess()

  const payslip = await db.payslip.findUnique({
    where: { id: payslipId },
    include: { payrollPeriod: true },
  })

  if (!payslip || payslip.payrollPeriod.status === 'FINALIZED') return

  const { year, month } = payslip.payrollPeriod

  const [ramadanPeriods, assignments, employee] = await Promise.all([
    db.ramadanPeriod.findMany(),
    db.operatorAssignment.findMany({
      where: { operatorId: payslip.employeeId },
      select: {
        timesheets: {
          where: { year, month, status: 'SIGNED' },
          include: { days: { select: { workingHours: true } } },
        },
      },
    }),
    db.employee.findUniqueOrThrow({
      where: { id: payslip.employeeId },
      select: { id: true, dateOfJoining: true },
    }),
  ])

  const ramadanRanges = ramadanPeriods.map((period) => ({
    startDate: period.startDate,
    endDate: period.endDate,
  }))

  const standardHours = standardHoursForMonth({ year, month, ramadanPeriods: ramadanRanges })

  const { paidLeaveHours, unpaidLeaveHours } = await leaveHoursForEmployeePeriod(
    employee,
    year,
    month,
    ramadanRanges,
  )

  const signedDays = assignments.flatMap((a) => a.timesheets.flatMap((ts) => ts.days))
  const { hoursSource, regularHours, overtimeHours } = resolveHours(
    standardHours,
    signedDays,
    paidLeaveHours,
    unpaidLeaveHours,
  )

  const calc = computePayslip({
    basicSalary: payslip.basicSalary,
    housingAllowance: payslip.housingAllowance,
    transportAllowance: payslip.transportAllowance,
    foodAllowance: payslip.foodAllowance,
    siteAllowance: payslip.siteAllowance,
    otherAllowance: payslip.otherAllowance,
    standardHours,
    regularHours,
    overtimeHours,
    paidLeaveHours,
    unpaidLeaveHours,
    deductionsAmount: payslip.deductionsAmount,
  })

  await db.payslip.update({
    where: { id: payslipId },
    data: {
      hoursSource,
      standardHours,
      regularHours,
      overtimeHours,
      paidLeaveHours,
      unpaidLeaveHours,
      shortfallDeduction: calc.shortfallDeduction,
      overtimePay: calc.overtimePay,
      grossPay: calc.grossPay,
      netPay: calc.netPay,
    },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Payslip',
    entityId: payslipId,
    entityLabel: 'Re-pulled hours',
    changedFields: [
      diffField('Regular hours', payslip.regularHours, regularHours, (n) => n.toFixed(1)),
      diffField('Overtime hours', payslip.overtimeHours, overtimeHours, (n) => n.toFixed(1)),
      diffField('Net pay', payslip.netPay, calc.netPay, fmt.money),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath(`/payroll/${payslip.payrollPeriodId}`)
  revalidatePath(`/payroll/payslip/${payslipId}`)
}

export async function updatePayslip(
  payslipId: string,
  _prev: UpdatePayslipActionState,
  formData: FormData,
): Promise<UpdatePayslipActionState> {
  const user = await requirePayrollAccess()

  const payslip = await db.payslip.findUnique({
    where: { id: payslipId },
    include: { payrollPeriod: true },
  })

  if (!payslip) return { errors: { form: 'Payslip not found.' } }
  if (payslip.payrollPeriod.status === 'FINALIZED') {
    return { errors: { form: 'This payroll period is finalized — unfinalize it first to make changes.' } }
  }

  const regularHours = Number(formData.get('regularHours'))
  const overtimeHours = Number(formData.get('overtimeHours'))
  const paidLeaveHours = Number(formData.get('paidLeaveHours') || '0')
  const unpaidLeaveHours = Number(formData.get('unpaidLeaveHours') || '0')
  const deductionsAmountRiyals = Number(formData.get('deductionsAmount') || '0')
  const deductionsNote = String(formData.get('deductionsNote') ?? '').trim() || null

  if (!Number.isFinite(regularHours) || regularHours < 0) {
    return { errors: { form: 'Regular hours must be a positive number.' } }
  }
  if (!Number.isFinite(overtimeHours) || overtimeHours < 0) {
    return { errors: { form: 'Overtime hours must be a positive number.' } }
  }
  if (!Number.isFinite(paidLeaveHours) || paidLeaveHours < 0) {
    return { errors: { form: 'Paid leave hours must be a positive number.' } }
  }
  if (!Number.isFinite(unpaidLeaveHours) || unpaidLeaveHours < 0) {
    return { errors: { form: 'Unpaid leave hours must be a positive number.' } }
  }
  if (!Number.isFinite(deductionsAmountRiyals) || deductionsAmountRiyals < 0) {
    return { errors: { form: 'Deductions must be a positive number.' } }
  }

  const deductionsAmount = Math.round(deductionsAmountRiyals * 100)

  const calc = computePayslip({
    basicSalary: payslip.basicSalary,
    housingAllowance: payslip.housingAllowance,
    transportAllowance: payslip.transportAllowance,
    foodAllowance: payslip.foodAllowance,
    siteAllowance: payslip.siteAllowance,
    otherAllowance: payslip.otherAllowance,
    standardHours: payslip.standardHours,
    regularHours,
    overtimeHours,
    paidLeaveHours,
    unpaidLeaveHours,
    deductionsAmount,
  })

  await db.payslip.update({
    where: { id: payslipId },
    data: {
      regularHours,
      overtimeHours,
      paidLeaveHours,
      unpaidLeaveHours,
      deductionsAmount,
      deductionsNote,
      shortfallDeduction: calc.shortfallDeduction,
      overtimePay: calc.overtimePay,
      grossPay: calc.grossPay,
      netPay: calc.netPay,
    },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Payslip',
    entityId: payslipId,
    entityLabel: null,
    changedFields: [
      diffField('Regular hours', payslip.regularHours, regularHours, (n) => n.toFixed(1)),
      diffField('Overtime hours', payslip.overtimeHours, overtimeHours, (n) => n.toFixed(1)),
      diffField('Deductions', payslip.deductionsAmount, deductionsAmount, fmt.money),
      diffField('Deductions note', payslip.deductionsNote, deductionsNote),
      diffField('Net pay', payslip.netPay, calc.netPay, fmt.money),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath(`/payroll/${payslip.payrollPeriodId}`)
  revalidatePath(`/payroll/payslip/${payslipId}`)
  return { ok: true }
}

export async function finalizePayrollPeriod(id: string) {
  const user = await requirePayrollAccess()

  const period = await db.payrollPeriod.update({
    where: { id },
    data: { status: 'FINALIZED', finalizedDate: todayUtc() },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'PayrollPeriod',
    entityId: period.id,
    entityLabel: `Finalized — ${period.month}/${period.year}`,
    changedFields: [{ field: 'Status', was: 'Draft', now: 'Finalized' }],
  })

  revalidatePath(`/payroll/${id}`)
  revalidatePath('/payroll')
}

export async function unfinalizePayrollPeriod(id: string) {
  const user = await requirePayrollAccess()

  const period = await db.payrollPeriod.update({
    where: { id },
    data: { status: 'DRAFT', finalizedDate: null },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'PayrollPeriod',
    entityId: period.id,
    entityLabel: `Unfinalized — ${period.month}/${period.year}`,
    changedFields: [{ field: 'Status', was: 'Finalized', now: 'Draft' }],
  })

  revalidatePath(`/payroll/${id}`)
  revalidatePath('/payroll')
}
