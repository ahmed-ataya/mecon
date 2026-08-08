'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { fieldErrors, lpoSchema } from '../validation'

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

export async function createLpo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)
  const parsed = lpoSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  // The number is unique so contracts can point at one unambiguous LPO.
  const clash = await db.lpo.findUnique({
    where: { number: parsed.data.number },
  })

  if (clash) {
    return {
      errors: { number: 'An LPO with that number already exists.' },
      values,
    }
  }

  const lpo = await db.lpo.create({ data: parsed.data })

  revalidatePath('/lpos')
  redirect(`/lpos/${lpo.id}`)
}

export async function updateLpo(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readForm(formData)
  const parsed = lpoSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const clash = await db.lpo.findUnique({
    where: { number: parsed.data.number },
  })

  if (clash && clash.id !== id) {
    return {
      errors: { number: 'Another LPO already uses that number.' },
      values,
    }
  }

  await db.lpo.update({ where: { id }, data: parsed.data })

  revalidatePath('/lpos')
  revalidatePath(`/lpos/${id}`)
  revalidatePath('/contracts')
  redirect(`/lpos/${id}`)
}

export async function deleteLpo(id: string) {
  // Contracts point at the LPO; removing it underneath them would leave their
  // commercial basis unrecorded.
  const contractCount = await db.contract.count({ where: { lpoId: id } })

  if (contractCount > 0) {
    return {
      error: `This LPO covers ${contractCount} contract(s) and cannot be deleted.`,
    }
  }

  await db.lpo.delete({ where: { id } })

  revalidatePath('/lpos')
  redirect('/lpos')
}
