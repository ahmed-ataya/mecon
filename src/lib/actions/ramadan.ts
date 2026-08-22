'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { fieldErrors, ramadanPeriodSchema } from '../validation'
import { requirePayrollAccess } from '../auth/guard'
import { logAudit } from '../audit'

export type RamadanActionState = {
  errors?: Record<string, string>
  values?: { year: string; startDate: string; endDate: string }
}

export async function createRamadanPeriod(
  _prev: RamadanActionState,
  formData: FormData,
): Promise<RamadanActionState> {
  const user = await requirePayrollAccess()

  const values = {
    year: String(formData.get('year') ?? ''),
    startDate: String(formData.get('startDate') ?? ''),
    endDate: String(formData.get('endDate') ?? ''),
  }
  const parsed = ramadanPeriodSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const existing = await db.ramadanPeriod.findUnique({
    where: { year: parsed.data.year },
  })

  if (existing) {
    return {
      errors: { form: `A Ramadan period for ${parsed.data.year} already exists.` },
      values,
    }
  }

  const period = await db.ramadanPeriod.create({ data: parsed.data })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'RamadanPeriod',
    entityId: period.id,
    entityLabel: String(period.year),
  })

  revalidatePath('/payroll/ramadan')
  return {}
}

export async function deleteRamadanPeriod(id: string) {
  const user = await requirePayrollAccess()

  const period = await db.ramadanPeriod.delete({ where: { id } })

  await logAudit({
    user,
    action: 'DELETE',
    entityType: 'RamadanPeriod',
    entityId: period.id,
    entityLabel: String(period.year),
  })

  revalidatePath('/payroll/ramadan')
}
