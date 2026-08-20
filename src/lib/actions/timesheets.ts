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
import { fieldErrors, timesheetCreateSchema } from '../validation'

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

  const rows: {
    id: string
    startTime: string | null
    endTime: string | null
    workingHours: number
    breakdownHours: number
    remarks: string | null
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
    })
  }

  return rows
}

class RowValidationError extends Error {}

// --- Equipment timesheets ---------------------------------------------------

export async function createEquipmentTimesheet(
  _prev: CreateActionState,
  formData: FormData,
): Promise<CreateActionState> {
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

  revalidatePath('/timesheets')
  redirect(`/timesheets/equipment/${timesheet.id}`)
}

export async function updateEquipmentTimesheetDays(
  timesheetId: string,
  _prev: UpdateDaysActionState,
  formData: FormData,
): Promise<UpdateDaysActionState> {
  const timesheet = await db.equipmentTimesheet.findUnique({
    where: { id: timesheetId },
    select: { status: true },
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

  revalidatePath(`/timesheets/equipment/${timesheetId}`)
  return { ok: true }
}

export async function signEquipmentTimesheet(id: string) {
  await db.equipmentTimesheet.update({
    where: { id },
    data: { status: 'SIGNED', signedDate: todayUtc() },
  })

  revalidatePath(`/timesheets/equipment/${id}`)
  revalidatePath('/timesheets')
}

export async function unsignEquipmentTimesheet(id: string) {
  await db.equipmentTimesheet.update({
    where: { id },
    data: { status: 'DRAFT', signedDate: null },
  })

  revalidatePath(`/timesheets/equipment/${id}`)
  revalidatePath('/timesheets')
}

// --- Operator timesheets -----------------------------------------------------

export async function createOperatorTimesheet(
  _prev: CreateActionState,
  formData: FormData,
): Promise<CreateActionState> {
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

  const timesheet = await db.operatorTimesheet.create({
    data: {
      referenceNumber,
      operatorAssignmentId: assignmentId,
      year,
      month,
      days: {
        create: days.map((date) => ({
          date,
          workingHours: defaultHoursForDay(date, OPERATOR_DEFAULT_HOURS_PER_DAY),
        })),
      },
    },
  })

  revalidatePath('/timesheets')
  redirect(`/timesheets/operator/${timesheet.id}`)
}

export async function updateOperatorTimesheetDays(
  timesheetId: string,
  _prev: UpdateDaysActionState,
  formData: FormData,
): Promise<UpdateDaysActionState> {
  const timesheet = await db.operatorTimesheet.findUnique({
    where: { id: timesheetId },
    select: { status: true },
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
        },
      }),
    ),
  )

  revalidatePath(`/timesheets/operator/${timesheetId}`)
  return { ok: true }
}

export async function signOperatorTimesheet(id: string) {
  await db.operatorTimesheet.update({
    where: { id },
    data: { status: 'SIGNED', signedDate: todayUtc() },
  })

  revalidatePath(`/timesheets/operator/${id}`)
  revalidatePath('/timesheets')
}

export async function unsignOperatorTimesheet(id: string) {
  await db.operatorTimesheet.update({
    where: { id },
    data: { status: 'DRAFT', signedDate: null },
  })

  revalidatePath(`/timesheets/operator/${id}`)
  revalidatePath('/timesheets')
}
