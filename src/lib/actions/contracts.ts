'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { dayBefore } from '../dates'
import {
  contractSchema,
  equipmentAssignmentSchema,
  fieldErrors,
  operatorAssignmentSchema,
} from '../validation'
import { requireWrite } from '../auth/guard'
import { createdField, diffField, fmt, type FieldChange, logAudit } from '../audit'

/** `values` echoes the submitted form back on failure — see actions/customers.ts */
export type ActionState = {
  errors?: Record<string, string>
  values?: Record<string, string>
  /**
   * Set on success INSTEAD OF redirecting server-side, for createContract only.
   * The browser-only draft has to be cleared before navigating away, and a
   * server-side redirect() unmounts the form first — there is no client-side
   * moment left to do it in. Returning here gives the form that moment; it
   * clears the draft and navigates itself. See ContractForm.tsx.
   */
  ok?: boolean
  id?: string
}

function readForm(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value
  }

  return values
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/**
 * Creates the contract with its single machine and its operator arrangement,
 * in one transaction.
 *
 * One contract, one machine — three machines on a job means three contracts.
 * Both assignments start on the mobilization date. A contract with nothing on
 * it is not a useful record, and a half-created one is worse.
 */
export async function createContract(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()
  const values = readForm(formData)

  const contract = contractSchema.safeParse(values)
  const equipment = equipmentAssignmentSchema.safeParse({
    ...values,
    startDate: values.mobilizationDate ?? '',
    reason: 'INITIAL',
  })
  const operator = operatorAssignmentSchema.safeParse({
    ...values,
    startDate: values.mobilizationDate ?? '',
    reason: 'INITIAL',
  })

  if (!contract.success || !equipment.success || !operator.success) {
    return {
      errors: {
        ...(contract.success ? {} : fieldErrors(contract.error)),
        ...(equipment.success ? {} : fieldErrors(equipment.error)),
        ...(operator.success ? {} : fieldErrors(operator.error)),
      },
      values,
    }
  }

  const created = await db.contract.create({
    data: {
      ...contract.data,
      equipmentAssignments: {
        create: {
          equipmentId: equipment.data.equipmentId,
          startDate: contract.data.mobilizationDate,
          rateType: equipment.data.rateType,
          rateAmount: equipment.data.rateAmount,
          reason: 'INITIAL',
          note: equipment.data.note,
        },
      },
      operatorAssignments: {
        create: {
          arrangement: operator.data.arrangement,
          operatorId:
            operator.data.arrangement === 'WITHOUT_OPERATOR'
              ? null
              : operator.data.operatorId,
          startDate: contract.data.mobilizationDate,
          reason: 'INITIAL',
          operatorHourlyCost: operator.data.operatorHourlyCost,
          note: operator.data.note,
        },
      },
    },
  })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'Contract',
    entityId: created.id,
    entityLabel: created.projectName,
    changedFields: [
      createdField('Project', created.projectName),
      createdField('Site', created.siteName),
      createdField('Mobilisation date', created.mobilizationDate, fmt.date),
      createdField('Hourly rate', equipment.data.rateAmount, fmt.money),
    ],
  })

  revalidatePath('/contracts')
  return { ok: true, id: created.id }
}

export async function updateContract(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()
  const values = readForm(formData)
  const parsed = contractSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const before = await db.contract.findUnique({ where: { id } })
  const contract = await db.contract.update({ where: { id }, data: parsed.data })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Contract',
    entityId: contract.id,
    entityLabel: contract.projectName,
    changedFields: [
      diffField('Project', before?.projectName, contract.projectName),
      diffField('Site', before?.siteName, contract.siteName),
      diffField('Mobilisation date', before?.mobilizationDate, contract.mobilizationDate, fmt.date),
      diffField('Closing date', before?.closingDate, contract.closingDate, fmt.date),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${id}`)
  redirect(`/contracts/${id}`)
}

// ---------------------------------------------------------------------------
// Equipment assignments
// ---------------------------------------------------------------------------

/**
 * THE core rule of this system: a replacement never overwrites the assignment
 * it replaces.
 *
 * The outgoing assignment is closed the day BEFORE the replacement starts, and
 * a new row is opened. The contract and its mobilization date are untouched —
 * they belong to the project, not to the machine. Billing therefore stays
 * continuous across the swap, with each machine's actual days intact.
 *
 * Both writes happen in one transaction: a closed assignment with no
 * replacement, or two open assignments for the same slot, would both corrupt
 * the billing history.
 */
export async function replaceEquipment(
  assignmentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()
  const values = readForm(formData)
  const parsed = equipmentAssignmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const outgoing = await db.equipmentAssignment.findUnique({
    where: { id: assignmentId },
  })

  if (!outgoing) {
    return { errors: { form: 'That assignment no longer exists.' }, values }
  }

  if (parsed.data.startDate <= outgoing.startDate) {
    return {
      errors: {
        startDate: `The replacement must start after the outgoing machine started.`,
      },
      values,
    }
  }

  const [outgoingEquipment, incomingEquipment] = await Promise.all([
    db.equipment.findUnique({ where: { id: outgoing.equipmentId }, select: { name: true } }),
    db.equipment.findUnique({ where: { id: parsed.data.equipmentId }, select: { name: true } }),
  ])

  await db.$transaction([
    db.equipmentAssignment.update({
      where: { id: assignmentId },
      data: { endDate: dayBefore(parsed.data.startDate) },
    }),
    db.equipmentAssignment.create({
      data: {
        contractId: outgoing.contractId,
        equipmentId: parsed.data.equipmentId,
        startDate: parsed.data.startDate,
        rateType: parsed.data.rateType,
        rateAmount: parsed.data.rateAmount,
        reason: parsed.data.reason,
        note: parsed.data.note,
      },
    }),
  ])

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Contract',
    entityId: outgoing.contractId,
    entityLabel: 'Machine replaced',
    changedFields: [
      diffField('Machine', outgoingEquipment?.name ?? null, incomingEquipment?.name ?? null),
      diffField('Hourly rate', outgoing.rateAmount, parsed.data.rateAmount, fmt.money),
      createdField('Start date', parsed.data.startDate, fmt.date),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${outgoing.contractId}`)

  return {}
}

/** Takes a machine off the contract without putting another in its place. */
export async function endEquipmentAssignment(
  assignmentId: string,
  endDate: Date,
) {
  const user = await requireWrite()

  const assignment = await db.equipmentAssignment.update({
    where: { id: assignmentId },
    data: { endDate },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Contract',
    entityId: assignment.contractId,
    entityLabel: 'Equipment assignment ended',
    changedFields: [createdField('End date', assignment.endDate, fmt.date)],
  })

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${assignment.contractId}`)
}

// ---------------------------------------------------------------------------
// Operator assignments
// ---------------------------------------------------------------------------

/** Same close-and-open rule as replaceEquipment — see the note there. */
export async function replaceOperator(
  assignmentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()
  const values = readForm(formData)
  const parsed = operatorAssignmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const outgoing = await db.operatorAssignment.findUnique({
    where: { id: assignmentId },
  })

  if (!outgoing) {
    return { errors: { form: 'That assignment no longer exists.' }, values }
  }

  if (parsed.data.startDate <= outgoing.startDate) {
    return {
      errors: {
        startDate: 'The replacement must start after the outgoing one started.',
      },
      values,
    }
  }

  const incomingOperatorId =
    parsed.data.arrangement === 'WITHOUT_OPERATOR' ? null : parsed.data.operatorId

  const [outgoingOperator, incomingOperator] = await Promise.all([
    outgoing.operatorId
      ? db.employee.findUnique({ where: { id: outgoing.operatorId }, select: { name: true } })
      : null,
    incomingOperatorId
      ? db.employee.findUnique({ where: { id: incomingOperatorId }, select: { name: true } })
      : null,
  ])

  await db.$transaction([
    db.operatorAssignment.update({
      where: { id: assignmentId },
      data: { endDate: dayBefore(parsed.data.startDate) },
    }),
    db.operatorAssignment.create({
      data: {
        contractId: outgoing.contractId,
        arrangement: parsed.data.arrangement,
        operatorId: incomingOperatorId,
        startDate: parsed.data.startDate,
        reason: parsed.data.reason,
        operatorHourlyCost: parsed.data.operatorHourlyCost,
        note: parsed.data.note,
      },
    }),
  ])

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Contract',
    entityId: outgoing.contractId,
    entityLabel: 'Operator replaced',
    changedFields: [
      diffField(
        'Operator',
        outgoingOperator?.name ?? 'Without operator',
        incomingOperator?.name ?? 'Without operator',
      ),
      createdField('Start date', parsed.data.startDate, fmt.date),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${outgoing.contractId}`)

  return {}
}

// ---------------------------------------------------------------------------
// Double-booking
// ---------------------------------------------------------------------------

/**
 * Other contracts using this machine over an overlapping period.
 *
 * A null endDate means open-ended, which overlaps everything after its start.
 * Warn only — see warnings.ts for why nothing here blocks.
 */
export async function findEquipmentClashes(
  equipmentId: string,
  startDate: Date,
  endDate: Date | null,
  excludeContractId?: string,
) {
  const clashes = await db.equipmentAssignment.findMany({
    where: {
      equipmentId,
      contractId: excludeContractId ? { not: excludeContractId } : undefined,
      // Overlap: this assignment starts before the other ends, AND the other
      // starts before this one ends.
      ...(endDate ? { startDate: { lte: endDate } } : {}),
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
    include: { contract: { select: { id: true, projectName: true } } },
  })

  return clashes.map((clash) => ({
    projectName: clash.contract.projectName,
    contractId: clash.contract.id,
  }))
}
