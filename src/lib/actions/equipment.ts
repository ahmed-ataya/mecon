'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { equipmentSchema, fieldErrors } from '../validation'
import { requireDelete, requireWrite } from '../auth/guard'
import { logAudit } from '../audit'

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
    brand: String(formData.get('brand') ?? ''),
    model: String(formData.get('model') ?? ''),
    yearOfManufacture: String(formData.get('yearOfManufacture') ?? ''),
    capacityValue: String(formData.get('capacityValue') ?? ''),
    capacityUnit: String(formData.get('capacityUnit') ?? 'TON'),
    serialNumber: String(formData.get('serialNumber') ?? ''),
    plateNumber: String(formData.get('plateNumber') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }
}

export async function createEquipment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()

  const values = readEquipmentForm(formData)
  const parsed = equipmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const equipment = await db.equipment.create({ data: parsed.data })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'Equipment',
    entityId: equipment.id,
    entityLabel: equipment.name,
  })

  revalidatePath('/equipment')
  redirect(`/equipment/${equipment.id}`)
}

export async function updateEquipment(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()

  const values = readEquipmentForm(formData)
  const parsed = equipmentSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const equipment = await db.equipment.update({ where: { id }, data: parsed.data })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Equipment',
    entityId: equipment.id,
    entityLabel: equipment.name,
  })

  revalidatePath('/equipment')
  revalidatePath(`/equipment/${id}`)
  redirect(`/equipment/${id}`)
}

export async function deleteEquipment(id: string) {
  const user = await requireDelete()

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

  const equipment = await db.equipment.delete({ where: { id } })

  await logAudit({
    user,
    action: 'DELETE',
    entityType: 'Equipment',
    entityId: equipment.id,
    entityLabel: equipment.name,
  })

  revalidatePath('/equipment')
  redirect('/equipment')
}
