'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { fieldErrors, operatorSchema } from '../validation'

/** `values` echoes the submitted form back on failure — see actions/customers.ts */
export type ActionState = {
  errors?: Record<string, string>
  values?: OperatorFormValues
}

export type OperatorFormValues = ReturnType<typeof readOperatorForm> & {
  qualifiedEquipmentTypes: string[]
}

function readOperatorForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    nationality: String(formData.get('nationality') ?? ''),
    source: String(formData.get('source') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }
}

/**
 * Phase B2 — which equipment types this operator is qualified to run.
 *
 * Folded into `values` on every path, including validation failure — a
 * validation error on, say, the name field must not silently drop tags the
 * user had just added. A field left out of the echoed values on a failed
 * submit has bitten this project before (the contract form's operator cost
 * field, fixed earlier).
 */
function readQualifiedTypes(formData: FormData): string[] {
  return [...new Set(
    formData
      .getAll('qualifiedEquipmentTypes')
      .map((value) => String(value).trim())
      .filter(Boolean),
  )]
}

export async function createOperator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readOperatorForm(formData)
  const qualifiedTypes = readQualifiedTypes(formData)
  const parsed = operatorSchema.safeParse(values)

  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed.error),
      values: { ...values, qualifiedEquipmentTypes: qualifiedTypes },
    }
  }

  const operator = await db.employee.create({
    data: {
      ...parsed.data,
      // Explicit, not just relying on the column default — this action is
      // reached only from the operators UI, so it should only ever be able
      // to create an operator (Phase E0: Employee now holds other categories
      // too).
      category: 'OPERATOR',
      qualifications: {
        create: qualifiedTypes.map((equipmentType) => ({ equipmentType })),
      },
    },
  })

  revalidatePath('/operators')
  redirect(`/operators/${operator.id}`)
}

export async function updateOperator(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readOperatorForm(formData)
  const qualifiedTypes = readQualifiedTypes(formData)
  const parsed = operatorSchema.safeParse(values)

  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed.error),
      values: { ...values, qualifiedEquipmentTypes: qualifiedTypes },
    }
  }

  // Nested write, not a $transaction — see updateDocument's approvedFor for
  // why: Neon's pooled connection plus a cold start pushed $transaction past
  // its start timeout here before.
  await db.employee.update({
    where: { id },
    data: {
      ...parsed.data,
      qualifications: {
        deleteMany: {},
        create: qualifiedTypes.map((equipmentType) => ({ equipmentType })),
      },
    },
  })

  revalidatePath('/operators')
  revalidatePath(`/operators/${id}`)
  redirect(`/operators/${id}`)
}

export async function deleteOperator(id: string) {
  // Documents cascade. Assignments do not — an operator with assignment
  // history is part of a contract's billing record.
  const assignmentCount = await db.operatorAssignment.count({
    where: { operatorId: id },
  })

  if (assignmentCount > 0) {
    return {
      error: `This operator has ${assignmentCount} assignment(s) and cannot be deleted.`,
    }
  }

  await db.employee.delete({ where: { id } })

  revalidatePath('/operators')
  redirect('/operators')
}
