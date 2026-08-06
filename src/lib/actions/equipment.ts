'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { equipmentSchema, fieldErrors } from '../validation'

/** `values` echoes the submitted form back on failure — see actions/customers.ts */
export type ActionState = {
  errors?: Record<string, string>
  values?: EquipmentFormValues
}

export type EquipmentFormValues = ReturnType<typeof readEquipmentForm>

function readEquipmentForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    type: String(formData.get('type') ?? ''),
    serialNumber: String(formData.get('serialNumber') ?? ''),
    plateNumber: String(formData.get('plateNumber') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }
}

export async function createEquipment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readEquipmentForm(formData)
  const parsed = equipmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const equipment = await db.equipment.create({ data: parsed.data })

  revalidatePath('/equipment')
  redirect(`/equipment/${equipment.id}`)
}

export async function updateEquipment(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readEquipmentForm(formData)
  const parsed = equipmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  await db.equipment.update({ where: { id }, data: parsed.data })

  revalidatePath('/equipment')
  revalidatePath(`/equipment/${id}`)
  redirect(`/equipment/${id}`)
}

export async function deleteEquipment(id: string) {
  // Documents cascade. Assignments do not — a machine with assignment history
  // is part of a contract's billing record and must not disappear.
  const assignmentCount = await db.equipmentAssignment.count({
    where: { equipmentId: id },
  })

  if (assignmentCount > 0) {
    return {
      error: `This machine has ${assignmentCount} assignment(s) and cannot be deleted.`,
    }
  }

  await db.equipment.delete({ where: { id } })

  revalidatePath('/equipment')
  redirect('/equipment')
}
