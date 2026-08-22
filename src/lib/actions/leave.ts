'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { todayUtc } from '../dates'
import { fieldErrors, leaveRequestSchema, publicHolidaySchema } from '../validation'
import { requireDelete, requireWrite } from '../auth/guard'
import { createdField, deletedField, fmt, logAudit } from '../audit'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, type LeaveStatus, type LeaveType } from '../enums'

/**
 * "Approval" is a status field only, not a real approval trail — there is
 * no user-account system yet to authenticate who decided what (confirmed
 * scope, ROADMAP.md Phase E2). decidedBy is free text for whoever is using
 * the system to type their own name against the decision.
 */

export type LeaveRequestActionState = {
  errors?: Record<string, string>
  values?: {
    employeeId: string
    leaveType: string
    startDate: string
    endDate: string
    paidOverride: string
    note: string
  }
}

function readLeaveRequestForm(formData: FormData) {
  return {
    employeeId: String(formData.get('employeeId') ?? ''),
    leaveType: String(formData.get('leaveType') ?? ''),
    startDate: String(formData.get('startDate') ?? ''),
    endDate: String(formData.get('endDate') ?? ''),
    paidOverride: String(formData.get('paidOverride') ?? ''),
    note: String(formData.get('note') ?? ''),
  }
}

export async function createLeaveRequest(
  _prev: LeaveRequestActionState,
  formData: FormData,
): Promise<LeaveRequestActionState> {
  const user = await requireWrite()

  const values = readLeaveRequestForm(formData)
  const parsed = leaveRequestSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const employee = await db.employee.findUnique({ where: { id: parsed.data.employeeId } })
  if (!employee) {
    return { errors: { form: 'That employee no longer exists.' }, values }
  }

  const request = await db.leaveRequest.create({
    data: {
      employeeId: parsed.data.employeeId,
      leaveType: parsed.data.leaveType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      paidOverride: parsed.data.paidOverride,
      note: parsed.data.note,
    },
  })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'LeaveRequest',
    entityId: request.id,
    entityLabel: `${employee.name} — ${parsed.data.leaveType}`,
    changedFields: [
      createdField('Employee', employee.name),
      createdField('Leave type', request.leaveType as LeaveType, (t) => LEAVE_TYPE_LABELS[t]),
      createdField('Start date', request.startDate, fmt.date),
      createdField('End date', request.endDate, fmt.date),
    ],
  })

  revalidatePath('/leave')
  revalidatePath(`/operators/${parsed.data.employeeId}`)
  redirect(`/leave/${request.id}`)
}

export type DecideActionState = {
  errors?: Record<string, string>
}

export async function approveLeaveRequest(
  id: string,
  _prev: DecideActionState,
  formData: FormData,
): Promise<DecideActionState> {
  const user = await requireWrite()

  const decidedBy = String(formData.get('decidedBy') ?? '').trim()
  if (!decidedBy) {
    return { errors: { form: 'Enter who is approving this request.' } }
  }

  const request = await db.leaveRequest.findUnique({ where: { id } })
  if (!request) return { errors: { form: 'Leave request not found.' } }

  await db.leaveRequest.update({
    where: { id },
    data: { status: 'APPROVED', decidedBy, decidedDate: todayUtc() },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'LeaveRequest',
    entityId: id,
    entityLabel: `Approved by ${decidedBy}`,
    changedFields: [
      {
        field: 'Status',
        was: LEAVE_STATUS_LABELS[request.status as LeaveStatus],
        now: LEAVE_STATUS_LABELS.APPROVED,
      },
      { field: 'Decided by', was: null, now: decidedBy },
    ],
  })

  revalidatePath('/leave')
  revalidatePath(`/leave/${id}`)
  revalidatePath(`/operators/${request.employeeId}`)
  return {}
}

export async function rejectLeaveRequest(
  id: string,
  _prev: DecideActionState,
  formData: FormData,
): Promise<DecideActionState> {
  const user = await requireWrite()

  const decidedBy = String(formData.get('decidedBy') ?? '').trim()
  if (!decidedBy) {
    return { errors: { form: 'Enter who is rejecting this request.' } }
  }

  const request = await db.leaveRequest.findUnique({ where: { id } })
  if (!request) return { errors: { form: 'Leave request not found.' } }

  await db.leaveRequest.update({
    where: { id },
    data: { status: 'REJECTED', decidedBy, decidedDate: todayUtc() },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'LeaveRequest',
    entityId: id,
    entityLabel: `Rejected by ${decidedBy}`,
    changedFields: [
      {
        field: 'Status',
        was: LEAVE_STATUS_LABELS[request.status as LeaveStatus],
        now: LEAVE_STATUS_LABELS.REJECTED,
      },
      { field: 'Decided by', was: null, now: decidedBy },
    ],
  })

  revalidatePath('/leave')
  revalidatePath(`/leave/${id}`)
  revalidatePath(`/operators/${request.employeeId}`)
  return {}
}

export async function cancelLeaveRequest(id: string) {
  const user = await requireWrite()

  const request = await db.leaveRequest.findUnique({ where: { id } })
  if (!request) return

  await db.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'LeaveRequest',
    entityId: id,
    entityLabel: 'Cancelled',
    changedFields: [
      {
        field: 'Status',
        was: LEAVE_STATUS_LABELS[request.status as LeaveStatus],
        now: LEAVE_STATUS_LABELS.CANCELLED,
      },
    ],
  })

  revalidatePath('/leave')
  revalidatePath(`/leave/${id}`)
  revalidatePath(`/operators/${request.employeeId}`)
}

// --- Public holidays ---------------------------------------------------------

export type PublicHolidayActionState = {
  errors?: Record<string, string>
  values?: { name: string; startDate: string; endDate: string }
}

export async function createPublicHoliday(
  _prev: PublicHolidayActionState,
  formData: FormData,
): Promise<PublicHolidayActionState> {
  const user = await requireWrite()

  const values = {
    name: String(formData.get('name') ?? ''),
    startDate: String(formData.get('startDate') ?? ''),
    endDate: String(formData.get('endDate') ?? ''),
  }
  const parsed = publicHolidaySchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const holiday = await db.publicHoliday.create({ data: parsed.data })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'PublicHoliday',
    entityId: holiday.id,
    entityLabel: holiday.name,
    changedFields: [
      createdField('Name', holiday.name),
      createdField('Start date', holiday.startDate, fmt.date),
      createdField('End date', holiday.endDate, fmt.date),
    ],
  })

  revalidatePath('/leave/holidays')
  return {}
}

export async function deletePublicHoliday(id: string) {
  const user = await requireDelete()

  const holiday = await db.publicHoliday.delete({ where: { id } })

  await logAudit({
    user,
    action: 'DELETE',
    entityType: 'PublicHoliday',
    entityId: holiday.id,
    entityLabel: holiday.name,
    changedFields: [
      deletedField('Name', holiday.name),
      deletedField('Start date', holiday.startDate, fmt.date),
      deletedField('End date', holiday.endDate, fmt.date),
    ],
  })

  revalidatePath('/leave/holidays')
}
