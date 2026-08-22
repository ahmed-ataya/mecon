'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { fieldErrors, lpoSchema } from '../validation'
import { requireDelete, requireWrite } from '../auth/guard'
import { logAudit } from '../audit'

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
  const user = await requireWrite()
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

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'Lpo',
    entityId: lpo.id,
    entityLabel: lpo.number,
  })

  revalidatePath('/lpos')
  redirect(`/lpos/${lpo.id}`)
}

export async function updateLpo(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()
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

  const lpo = await db.lpo.update({ where: { id }, data: parsed.data })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Lpo',
    entityId: lpo.id,
    entityLabel: lpo.number,
  })

  revalidatePath('/lpos')
  revalidatePath(`/lpos/${id}`)
  revalidatePath('/contracts')
  redirect(`/lpos/${id}`)
}

export async function deleteLpo(id: string) {
  const user = await requireDelete()

  // Contracts point at the LPO; removing it underneath them would leave their
  // commercial basis unrecorded.
  const contractCount = await db.contract.count({ where: { lpoId: id } })

  if (contractCount > 0) {
    return {
      error: `This LPO covers ${contractCount} contract(s) and cannot be deleted.`,
    }
  }

  const lpo = await db.lpo.delete({ where: { id } })

  await logAudit({
    user,
    action: 'DELETE',
    entityType: 'Lpo',
    entityId: lpo.id,
    entityLabel: lpo.number,
  })

  revalidatePath('/lpos')
  redirect('/lpos')
}
