'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { todayUtc } from '../dates'
import {
  daysInAssignmentMonth,
  defaultHoursForDay,
  EQUIPMENT_DEFAULT_HOURS_PER_DAY,
  monthLabel,
  OPERATOR_DEFAULT_HOURS_PER_DAY,
} from '../timesheet'
import {
  EQUIPMENT_TIMESHEET_PREFIX,
  OPERATOR_TIMESHEET_PREFIX,
  formatTimesheetNumber,
  nextTimesheetSequence,
} from '../timesheet-number'
import { resolveLeaveDaysInRange } from '../leave'
import type { LeaveType } from '../enums'
import { fieldErrors, timesheetCreateSchema } from '../validation'
import { requireWrite } from '../auth/guard'
import { createdField, diffField, type FieldChange, logAudit } from '../audit'

export type CreateActionState = {
  errors?: Record<string, string>
  values?: { assignmentId: string; year: string; month: string }
}

export type UpdateDaysActionState = {
  errors?: Record<string, string>
  ok?: boolean
}

function readCreateForm(formData: FormData) {
  return {
    assignmentId: String(formData.get('assignmentId') ?? ''),
    year: String(formData.get('year') ?? ''),
    month: String(formData.get('month') ?? ''),
  }
}

/**
 * Shared shape for reading the bulk day-rows submit. One row of parallel
 * FormData arrays, matched by position — the id is what ties each row back
 * to its EquipmentTimesheetDay/OperatorTimesheetDay record.
 */
function readDayRows(formData: FormData) {
  const ids = formData.getAll('dayId').map(String)
  const startTimes = formData.getAll('startTime').map(String)
  const endTimes = formData.getAll('endTime').map(String)
  const workingHoursRaw = formData.getAll('workingHours').map(String)
  const breakdownHoursRaw = formData.getAll('breakdownHours').map(String)
  const remarksRaw = formData.getAll('remarks').map(String)
  // Only present on the operator table (Phase E2) — absent entirely on the
  // equipment form, which never submits these inputs at all.
  const dayTypesRaw = formData.getAll('dayType').map(String)
  const leaveTypesRaw = formData.getAll('leaveType').map(String)

  const rows: {
    id: string
    startTime: string | null
    endTime: string | null
    workingHours: number
    breakdownHours: number
    remarks: string | null
    dayType: string
    leaveType: string | null
  }[] = []

  for (let i = 0; i < ids.length; i++) {
    const workingHours = workingHoursRaw[i]?.trim() === '' ? 0 : Number(workingHoursRaw[i])
    const breakdownHours = breakdownHoursRaw[i]?.trim() === '' ? 0 : Number(breakdownHoursRaw[i])

    if (!Number.isFinite(workingHours) || workingHours < 0 || workingHours > 24) {
      throw new RowValidationError(`Working hours must be between 0 and 24 (row ${i + 1}).`)
    }
    if (!Number.isFinite(breakdownHours) || breakdownHours < 0 || breakdownHours > 24) {
      throw new RowValidationError(`Breakdown hours must be between 0 and 24 (row ${i + 1}).`)
    }

    rows.push({
      id: ids[i],
      startTime: startTimes[i]?.trim() || null,
      endTime: endTimes[i]?.trim() || null,
      workingHours,
      breakdownHours,
      remarks: remarksRaw[i]?.trim() || null,
      dayType: dayTypesRaw[i]?.trim() || 'WORKING',
      leaveType: leaveTypesRaw[i]?.trim() || null,
    })
  }

  return rows
}

class RowValidationError extends Error {}

/**
 * Phase E2 — which of an operator's days in this range are already covered
 * by an APPROVED leave request or a declared public holiday, so a new
 * timesheet's days default to showing leave as leave rather than an
 * unworked gap (see OperatorTimesheetDay's model comment). Equipment
 * timesheets never call this — a machine doesn't take leave.
 */
async function resolveOperatorDayTypes(
  operatorId: string,
  days: Date[],
): Promise<Map<number, { dayType: string; leaveType: string | null }>> {
  const map = new Map<number, { dayType: string; leaveType: string | null }>()
  if (days.length === 0) return map

  const rangeStart = days[0]
  const rangeEnd = days[days.length - 1]

  const [approvedRequests, publicHolidays] = await Promise.all([
    db.leaveRequest.findMany({
      where: {
        employeeId: operatorId,
        status: 'APPROVED',
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
      },
    }),
    db.publicHoliday.findMany({
      where: { startDate: { lte: rangeEnd }, endDate: { gte: rangeStart } },
    }),
  ])

  const resolved = resolveLeaveDaysInRange({
    rangeStart,
    rangeEnd,
    approvedRequests: approvedRequests.map((r) => ({
      leaveType: r.leaveType as LeaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      paidOverride: r.paidOverride,
    })),
    publicHolidays,
    // Irrelevant here — only dayType/leaveType are read, never payFraction
    // (that's resolved fresh at payroll time from the same leave data).
    priorSickDaysThisServiceYear: 0,
  })

  for (const day of resolved) {
    map.set(day.date.getTime(), { dayType: day.dayType, leaveType: day.leaveType })
  }
  return map
}

// --- Equipment timesheets ---------------------------------------------------

export async function createEquipmentTimesheet(
  _prev: CreateActionState,
  formData: FormData,
): Promise<CreateActionState> {
  const user = await requireWrite()
  const values = readCreateForm(formData)
  const parsed = timesheetCreateSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const { assignmentId, year, month } = parsed.data

  const assignment = await db.equipmentAssignment.findUnique({
    where: { id: assignmentId },
  })

  if (!assignment) {
    return { errors: { form: 'That machine assignment no longer exists.' }, values }
  }

  const existing = await db.equipmentTimesheet.findUnique({
    where: {
      equipmentAssignmentId_year_month: {
        equipmentAssignmentId: assignmentId,
        year,
        month,
      },
    },
  })

  if (existing) {
    return {
      errors: {
        form: `A timesheet for ${monthLabel(year, month)} already exists for this machine.`,
      },
      values,
    }
  }

  const days = daysInAssignmentMonth({
    year,
    month,
    assignmentStart: assignment.startDate,
    assignmentEnd: assignment.endDate,
  })

  if (days.length === 0) {
    return {
      errors: { form: 'This machine was not assigned during that month.' },
      values,
    }
  }

  const existingNumbers = (
    await db.equipmentTimesheet.findMany({ select: { referenceNumber: true } })
  ).map((row) => row.referenceNumber)
  const referenceNumber = formatTimesheetNumber(
    EQUIPMENT_TIMESHEET_PREFIX,
    nextTimesheetSequence(EQUIPMENT_TIMESHEET_PREFIX, existingNumbers),
  )

  const timesheet = await db.equipmentTimesheet.create({
    data: {
      referenceNumber,
      equipmentAssignmentId: assignmentId,
      year,
      month,
      days: {
        create: days.map((date) => ({
          date,
          workingHours: defaultHoursForDay(date, EQUIPMENT_DEFAULT_HOURS_PER_DAY),
        })),
      },
    },
  })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'EquipmentTimesheet',
    entityId: timesheet.id,
    entityLabel: timesheet.referenceNumber,
    changedFields: [
      createdField('Period', monthLabel(year, month)),
      createdField('Days generated', days.length, (n) => String(n)),
    ],
  })

  revalidatePath('/timesheets')
  redirect(`/timesheets/equipment/${timesheet.id}`)
}

export async function updateEquipmentTimesheetDays(
  timesheetId: string,
  _prev: UpdateDaysActionState,
  formData: FormData,
): Promise<UpdateDaysActionState> {
  const user = await requireWrite()

  const timesheet = await db.equipmentTimesheet.findUnique({
    where: { id: timesheetId },
    select: { status: true, days: { select: { workingHours: true } } },
  })

  if (!timesheet) return { errors: { form: 'Timesheet not found.' } }
  if (timesheet.status === 'SIGNED') {
    return { errors: { form: 'This timesheet is signed — unsign it first to make changes.' } }
  }

  let rows
  try {
    rows = readDayRows(formData)
  } catch (error) {
    if (error instanceof RowValidationError) {
      return { errors: { form: error.message } }
    }
    throw error
  }

  await Promise.all(
    rows.map((row) =>
      db.equipmentTimesheetDay.update({
        where: { id: row.id },
        data: {
          startTime: row.startTime,
          endTime: row.endTime,
          workingHours: row.workingHours,
          breakdownHours: row.breakdownHours,
          remarks: row.remarks,
        },
      }),
    ),
  )

  // Day-by-day detail would be dozens of rows for one save — a total-hours
  // summary is the meaningful figure here, per AuditLog's own "meaningful
  // fields, not every column" guidance.
  const totalBefore = timesheet.days.reduce((sum, d) => sum + d.workingHours, 0)
  const totalAfter = rows.reduce((sum, r) => sum + r.workingHours, 0)

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'EquipmentTimesheet',
    entityId: timesheetId,
    entityLabel: null,
    changedFields: [
      diffField('Total working hours', totalBefore, totalAfter, (n) => n.toFixed(1)),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath(`/timesheets/equipment/${timesheetId}`)
  return { ok: true }
}

export async function signEquipmentTimesheet(id: string) {
  const user = await requireWrite()

  const timesheet = await db.equipmentTimesheet.update({
    where: { id },
    data: { status: 'SIGNED', signedDate: todayUtc() },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'EquipmentTimesheet',
    entityId: timesheet.id,
    entityLabel: 'Signed',
    changedFields: [{ field: 'Status', was: 'Draft', now: 'Signed' }],
  })

  revalidatePath(`/timesheets/equipment/${id}`)
  revalidatePath('/timesheets')
}

export async function unsignEquipmentTimesheet(id: string) {
  const user = await requireWrite()

  const timesheet = await db.equipmentTimesheet.update({
    where: { id },
    data: { status: 'DRAFT', signedDate: null },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'EquipmentTimesheet',
    entityId: timesheet.id,
    entityLabel: 'Unsigned',
    changedFields: [{ field: 'Status', was: 'Signed', now: 'Draft' }],
  })

  revalidatePath(`/timesheets/equipment/${id}`)
  revalidatePath('/timesheets')
}

// --- Operator timesheets -----------------------------------------------------

export async function createOperatorTimesheet(
  _prev: CreateActionState,
  formData: FormData,
): Promise<CreateActionState> {
  const user = await requireWrite()
  const values = readCreateForm(formData)
  const parsed = timesheetCreateSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const { assignmentId, year, month } = parsed.data

  const assignment = await db.operatorAssignment.findUnique({
    where: { id: assignmentId },
  })

  if (!assignment) {
    return { errors: { form: 'That operator assignment no longer exists.' }, values }
  }

  if (!assignment.operatorId) {
    return {
      errors: { form: 'This assignment has no operator to record a timesheet for.' },
      values,
    }
  }

  const existing = await db.operatorTimesheet.findUnique({
    where: {
      operatorAssignmentId_year_month: {
        operatorAssignmentId: assignmentId,
        year,
        month,
      },
    },
  })

  if (existing) {
    return {
      errors: {
        form: `A timesheet for ${monthLabel(year, month)} already exists for this operator.`,
      },
      values,
    }
  }

  const days = daysInAssignmentMonth({
    year,
    month,
    assignmentStart: assignment.startDate,
    assignmentEnd: assignment.endDate,
  })

  if (days.length === 0) {
    return {
      errors: { form: 'This operator was not assigned during that month.' },
      values,
    }
  }

  const existingNumbers = (
    await db.operatorTimesheet.findMany({ select: { referenceNumber: true } })
  ).map((row) => row.referenceNumber)
  const referenceNumber = formatTimesheetNumber(
    OPERATOR_TIMESHEET_PREFIX,
    nextTimesheetSequence(OPERATOR_TIMESHEET_PREFIX, existingNumbers),
  )

  const dayTypes = await resolveOperatorDayTypes(assignment.operatorId, days)

  const timesheet = await db.operatorTimesheet.create({
    data: {
      referenceNumber,
      operatorAssignmentId: assignmentId,
      year,
      month,
      days: {
        create: days.map((date) => {
          const resolved = dayTypes.get(date.getTime())
          return {
            date,
            // No hours "worked" on a leave or public-holiday day — see
            // OperatorTimesheetDay's model comment.
            workingHours: resolved
              ? 0
              : defaultHoursForDay(date, OPERATOR_DEFAULT_HOURS_PER_DAY),
            dayType: resolved?.dayType ?? 'WORKING',
            leaveType: resolved?.leaveType ?? null,
          }
        }),
      },
    },
  })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'OperatorTimesheet',
    entityId: timesheet.id,
    entityLabel: timesheet.referenceNumber,
    changedFields: [
      createdField('Period', monthLabel(year, month)),
      createdField('Days generated', days.length, (n) => String(n)),
    ],
  })

  revalidatePath('/timesheets')
  redirect(`/timesheets/operator/${timesheet.id}`)
}

export async function updateOperatorTimesheetDays(
  timesheetId: string,
  _prev: UpdateDaysActionState,
  formData: FormData,
): Promise<UpdateDaysActionState> {
  const user = await requireWrite()

  const timesheet = await db.operatorTimesheet.findUnique({
    where: { id: timesheetId },
    select: { status: true, days: { select: { workingHours: true } } },
  })

  if (!timesheet) return { errors: { form: 'Timesheet not found.' } }
  if (timesheet.status === 'SIGNED') {
    return { errors: { form: 'This timesheet is signed — unsign it first to make changes.' } }
  }

  let rows
  try {
    rows = readDayRows(formData)
  } catch (error) {
    if (error instanceof RowValidationError) {
      return { errors: { form: error.message } }
    }
    throw error
  }

  await Promise.all(
    rows.map((row) =>
      db.operatorTimesheetDay.update({
        where: { id: row.id },
        data: {
          startTime: row.startTime,
          endTime: row.endTime,
          workingHours: row.workingHours,
          breakdownHours: row.breakdownHours,
          remarks: row.remarks,
          dayType: row.dayType,
          leaveType: row.dayType === 'WORKING' ? null : row.leaveType,
        },
      }),
    ),
  )

  const totalBefore = timesheet.days.reduce((sum, d) => sum + d.workingHours, 0)
  const totalAfter = rows.reduce((sum, r) => sum + r.workingHours, 0)

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'OperatorTimesheet',
    entityId: timesheetId,
    entityLabel: null,
    changedFields: [
      diffField('Total working hours', totalBefore, totalAfter, (n) => n.toFixed(1)),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath(`/timesheets/operator/${timesheetId}`)
  return { ok: true }
}

export async function signOperatorTimesheet(id: string) {
  const user = await requireWrite()

  const timesheet = await db.operatorTimesheet.update({
    where: { id },
    data: { status: 'SIGNED', signedDate: todayUtc() },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'OperatorTimesheet',
    entityId: timesheet.id,
    entityLabel: 'Signed',
    changedFields: [{ field: 'Status', was: 'Draft', now: 'Signed' }],
  })

  revalidatePath(`/timesheets/operator/${id}`)
  revalidatePath('/timesheets')
}

export async function unsignOperatorTimesheet(id: string) {
  const user = await requireWrite()

  const timesheet = await db.operatorTimesheet.update({
    where: { id },
    data: { status: 'DRAFT', signedDate: null },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'OperatorTimesheet',
    entityId: timesheet.id,
    entityLabel: 'Unsigned',
    changedFields: [{ field: 'Status', was: 'Signed', now: 'Draft' }],
  })

  revalidatePath(`/timesheets/operator/${id}`)
  revalidatePath('/timesheets')
}
