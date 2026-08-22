'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { fieldErrors, operatorSchema } from '../validation'
import { requireDelete, requireWrite } from '../auth/guard'
import { canViewPayroll } from '../permissions'
import { logAudit } from '../audit'

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
    employeeNumber: String(formData.get('employeeNumber') ?? ''),
    jobTitle: String(formData.get('jobTitle') ?? ''),
    category: String(formData.get('category') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    nationality: String(formData.get('nationality') ?? ''),
    source: String(formData.get('source') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    dateOfJoining: String(formData.get('dateOfJoining') ?? ''),
    dateOfExit: String(formData.get('dateOfExit') ?? ''),
    annualLeaveEntitlementOverrideDays: String(
      formData.get('annualLeaveEntitlementOverrideDays') ?? '',
    ),
    basicSalary: String(formData.get('basicSalary') ?? ''),
    housingAllowance: String(formData.get('housingAllowance') ?? ''),
    transportAllowance: String(formData.get('transportAllowance') ?? ''),
    foodAllowance: String(formData.get('foodAllowance') ?? ''),
    siteAllowance: String(formData.get('siteAllowance') ?? ''),
    otherAllowance: String(formData.get('otherAllowance') ?? ''),
    housingProvidedInKind: formData.get('housingProvidedInKind') !== null,
    foodProvidedInKind: formData.get('foodProvidedInKind') !== null,
    bankName: String(formData.get('bankName') ?? ''),
    bankAccountNumber: String(formData.get('bankAccountNumber') ?? ''),
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

/**
 * Access control (Phase F) — salary/bank fields are Admin only. Deleting
 * them from the parsed data rather than zeroing them means a non-Admin
 * update simply never touches those columns, so existing salary data is
 * preserved untouched — the same reasoning the OperatorForm's stripped
 * `operator` prop follows on the read side.
 */
const PAYROLL_FIELDS = [
  'basicSalary',
  'housingAllowance',
  'transportAllowance',
  'foodAllowance',
  'siteAllowance',
  'otherAllowance',
  'housingProvidedInKind',
  'foodProvidedInKind',
  'bankName',
  'bankAccountNumber',
] as const

function stripPayrollFields<T extends Record<string, unknown>>(data: T): T {
  const copy = { ...data }
  for (const field of PAYROLL_FIELDS) delete copy[field]
  return copy
}

export async function createOperator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()

  const values = readOperatorForm(formData)
  const qualifiedTypes = readQualifiedTypes(formData)
  const parsed = operatorSchema.safeParse(values)

  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed.error),
      values: { ...values, qualifiedEquipmentTypes: qualifiedTypes },
    }
  }

  const data = canViewPayroll(user.role) ? parsed.data : stripPayrollFields(parsed.data)

  const operator = await db.employee.create({
    data: {
      ...data,
      qualifications: {
        create: qualifiedTypes.map((equipmentType) => ({ equipmentType })),
      },
    },
  })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'Employee',
    entityId: operator.id,
    entityLabel: operator.name,
  })

  revalidatePath('/operators')
  redirect(`/operators/${operator.id}`)
}

export async function updateOperator(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()

  const values = readOperatorForm(formData)
  const qualifiedTypes = readQualifiedTypes(formData)
  const parsed = operatorSchema.safeParse(values)

  if (!parsed.success) {
    return {
      errors: fieldErrors(parsed.error),
      values: { ...values, qualifiedEquipmentTypes: qualifiedTypes },
    }
  }

  const data = canViewPayroll(user.role) ? parsed.data : stripPayrollFields(parsed.data)

  // Nested write, not a $transaction — see updateDocument's approvedFor for
  // why: Neon's pooled connection plus a cold start pushed $transaction past
  // its start timeout here before.
  const operator = await db.employee.update({
    where: { id },
    data: {
      ...data,
      qualifications: {
        deleteMany: {},
        create: qualifiedTypes.map((equipmentType) => ({ equipmentType })),
      },
    },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Employee',
    entityId: operator.id,
    entityLabel: operator.name,
  })

  revalidatePath('/operators')
  revalidatePath(`/operators/${id}`)
  redirect(`/operators/${id}`)
}

export async function deleteOperator(id: string) {
  const user = await requireDelete()

  // Documents cascade. Assignments do not — an operator with assignment
  // history is part of a contract's billing record.
  const assignmentCount = await db.operatorAssignment.count({
    where: { operatorId: id },
  })

  if (assignmentCount > 0) {
    return {
      error: `This employee has ${assignmentCount} assignment(s) and cannot be deleted.`,
    }
  }

  const operator = await db.employee.delete({ where: { id } })

  await logAudit({
    user,
    action: 'DELETE',
    entityType: 'Employee',
    entityId: operator.id,
    entityLabel: operator.name,
  })

  revalidatePath('/operators')
  redirect('/operators')
}
