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

/**
 * Repeatable form rows read back as parallel arrays.
 *
 * Every row must render every field — hidden ones included — or the indexes
 * stop lining up and rows silently take each other's values.
 */
function readRows(
  formData: FormData,
  prefix: string,
  fields: string[],
): Record<string, string>[] {
  const columns = fields.map((field) =>
    formData.getAll(`${prefix}${field}`).map((value) => String(value)),
  )
  const rowCount = Math.max(0, ...columns.map((column) => column.length))

  const rows: Record<string, string>[] = []
  for (let index = 0; index < rowCount; index++) {
    const row: Record<string, string> = {}
    fields.forEach((field, column) => {
      row[field] = columns[column][index] ?? ''
    })
    rows.push(row)
  }

  return rows
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/**
 * Creates the contract together with EVERY machine and operator entered on the
 * form, in one transaction.
 *
 * Repeatable rows arrive as parallel arrays (m_* for machines, o_* for
 * operators) — every row renders every field, including hidden ones, so the
 * indexes line up. A contract with nothing on it is not a useful record, and a
 * half-created one is worse.
 */
export async function createContract(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)

  const contract = contractSchema.safeParse(values)

  const machineRows = readRows(formData, 'm_', [
    'equipmentId',
    'rateType',
    'rateAmount',
    'note',
  ])
  const operatorRows = readRows(formData, 'o_', [
    'arrangement',
    'operatorId',
    'equipmentId',
    'operatorCost',
    'operatorRebill',
    'note',
  ])

  const errors: Record<string, string> = contract.success
    ? {}
    : fieldErrors(contract.error)

  if (machineRows.length === 0) {
    errors.m_equipmentId = 'Add at least one machine'
  }

  // Assignments start on the mobilization date — the project's own date.
  const startDate = values.mobilizationDate ?? ''

  const machines = machineRows.map((row, index) => {
    const parsed = equipmentAssignmentSchema.safeParse({
      ...row,
      startDate,
      reason: 'INITIAL',
    })
    if (!parsed.success) {
      for (const [key, message] of Object.entries(fieldErrors(parsed.error))) {
        // Report against the row that actually failed.
        errors[`m_${key}_${index}`] ??= message
      }
    }
    return parsed
  })

  const operators = operatorRows.map((row, index) => {
    const parsed = operatorAssignmentSchema.safeParse({
      ...row,
      startDate,
      reason: 'INITIAL',
    })
    if (!parsed.success) {
      for (const [key, message] of Object.entries(fieldErrors(parsed.error))) {
        errors[`o_${key}_${index}`] ??= message
      }
    }
    return parsed
  })

  if (Object.keys(errors).length > 0 || !contract.success) {
    return { errors, values }
  }

  const created = await db.contract.create({
    data: {
      ...contract.data,
      equipmentAssignments: {
        create: machines
          .filter((m) => m.success)
          .map((m) => ({
            equipmentId: m.data.equipmentId,
            startDate: contract.data.mobilizationDate,
            rateType: m.data.rateType,
            rateAmount: m.data.rateAmount,
            reason: 'INITIAL',
            note: m.data.note,
          })),
      },
      operatorAssignments: {
        create: operators
          .filter((o) => o.success)
          .map((o) => ({
            arrangement: o.data.arrangement,
            operatorId:
              o.data.arrangement === 'WITHOUT_OPERATOR' ? null : o.data.operatorId,
            equipmentId: o.data.equipmentId,
            startDate: contract.data.mobilizationDate,
            reason: 'INITIAL',
            operatorCost: o.data.operatorCost,
            operatorRebill: o.data.operatorRebill,
            note: o.data.note,
          })),
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

  // Operators pointing at the outgoing machine would otherwise be left
  // referring to a machine no longer on the contract. Moving them is opt-in,
  // because sometimes the operator leaves with the machine.
  const carryOperators = formData.get('carryOperators') !== null

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
    ...(carryOperators
      ? [
          db.operatorAssignment.updateMany({
            where: {
              contractId: outgoing.contractId,
              equipmentId: outgoing.equipmentId,
              endDate: null,
            },
            data: { equipmentId: parsed.data.equipmentId },
          }),
        ]
      : []),
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

/**
 * Adds another operator alongside the existing ones, not a replacement.
 *
 * A contract can carry several operators for the same reason it can carry
 * several machines — typically one per machine.
 */
export async function addOperatorAssignment(
  contractId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)
  const parsed = operatorAssignmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  await db.operatorAssignment.create({
    data: {
      contractId,
      arrangement: parsed.data.arrangement,
      operatorId:
        parsed.data.arrangement === 'WITHOUT_OPERATOR'
          ? null
          : parsed.data.operatorId,
      equipmentId: parsed.data.equipmentId,
      startDate: parsed.data.startDate,
      reason: parsed.data.reason,
      operatorCost: parsed.data.operatorCost,
      operatorRebill: parsed.data.operatorRebill,
      note: parsed.data.note,
    },
  })

  revalidatePath('/contracts')
  revalidatePath(`/contracts/${contractId}`)

  return {}
}

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
        equipmentId: parsed.data.equipmentId ?? outgoing.equipmentId,
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
