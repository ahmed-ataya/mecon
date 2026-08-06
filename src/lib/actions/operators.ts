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

export type OperatorFormValues = ReturnType<typeof readOperatorForm>

function readOperatorForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    nationality: String(formData.get('nationality') ?? ''),
    source: String(formData.get('source') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }
}

export async function createOperator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readOperatorForm(formData)
  const parsed = operatorSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const operator = await db.operator.create({ data: parsed.data })

  revalidatePath('/operators')
  redirect(`/operators/${operator.id}`)
}

export async function updateOperator(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readOperatorForm(formData)
  const parsed = operatorSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  await db.operator.update({ where: { id }, data: parsed.data })

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

  await db.operator.delete({ where: { id } })

  revalidatePath('/operators')
  redirect('/operators')
}
