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

/** `values` echoes the submitted form back on failure — see actions/customers.ts */
export type ActionState = {
  errors?: Record<string, string>
  values?: Record<string, string>
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
 * Creates the contract together with its first equipment assignment and its
 * operator arrangement, in one transaction — a contract with no machine on it
 * is not a useful record, and a half-created one is worse.
 */
export async function createContract(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)

  const contract = contractSchema.safeParse(values)
  const equipment = equipmentAssignmentSchema.safeParse(values)
  const operator = operatorAssignmentSchema.safeParse({
    ...values,
    // The initial assignments both start when the contract mobilizes.
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
          // The first machine starts when the project mobilizes.
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
          operatorCost: operator.data.operatorCost,
          operatorRebill: operator.data.operatorRebill,
          note: operator.data.note,
        },
      },
    },
  })

  revalidatePath('/contracts')
  redirect(`/contracts/${created.id}`)
}

export async function updateContract(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)
  const parsed = contractSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  await db.contract.update({ where: { id }, data: parsed.data })

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

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${outgoing.contractId}`)

  return {}
}

/** Adds an additional machine alongside the existing ones, not a replacement. */
export async function addEquipmentAssignment(
  contractId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)
  const parsed = equipmentAssignmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  await db.equipmentAssignment.create({
    data: { contractId, ...parsed.data },
  })

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${contractId}`)

  return {}
}

/** Takes a machine off the contract without putting another in its place. */
export async function endEquipmentAssignment(
  assignmentId: string,
  endDate: Date,
) {
  const assignment = await db.equipmentAssignment.update({
    where: { id: assignmentId },
    data: { endDate },
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

  await db.$transaction([
    db.operatorAssignment.update({
      where: { id: assignmentId },
      data: { endDate: dayBefore(parsed.data.startDate) },
    }),
    db.operatorAssignment.create({
      data: {
        contractId: outgoing.contractId,
        arrangement: parsed.data.arrangement,
        operatorId:
          parsed.data.arrangement === 'WITHOUT_OPERATOR'
            ? null
            : parsed.data.operatorId,
        startDate: parsed.data.startDate,
        reason: parsed.data.reason,
        operatorCost: parsed.data.operatorCost,
        operatorRebill: parsed.data.operatorRebill,
        note: parsed.data.note,
      },
    }),
  ])

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
