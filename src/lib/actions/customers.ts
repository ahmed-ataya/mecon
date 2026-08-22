'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { customerSchema, fieldErrors } from '../validation'
import { requireDelete, requireWrite } from '../auth/guard'
import { logAudit } from '../audit'

/**
 * `values` echoes the submitted form back on failure. React resets a form once
 * its action resolves, so without this the user loses everything they typed
 * the moment one field fails validation.
 */
export type ActionState = {
  errors?: Record<string, string>
  values?: CustomerFormValues
}

export type CustomerFormValues = ReturnType<typeof readCustomerForm>

function readCustomerForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    contactPerson: String(formData.get('contactPerson') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    notes: String(formData.get('notes') ?? ''),
  }
}

export async function createCustomer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()

  const values = readCustomerForm(formData)
  const parsed = customerSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const customer = await db.customer.create({ data: parsed.data })

  await logAudit({
    user,
    action: 'CREATE',
    entityType: 'Customer',
    entityId: customer.id,
    entityLabel: customer.name,
  })

  revalidatePath('/customers')
  redirect(`/customers/${customer.id}`)
}

export async function updateCustomer(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()

  const values = readCustomerForm(formData)
  const parsed = customerSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const customer = await db.customer.update({ where: { id }, data: parsed.data })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Customer',
    entityId: customer.id,
    entityLabel: customer.name,
  })

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  redirect(`/customers/${id}`)
}

export async function deleteCustomer(id: string) {
  const user = await requireDelete()

  // Documents cascade with the customer. Contracts do not — a customer with
  // contract history must not be silently removed, so this refuses instead.
  const contractCount = await db.contract.count({ where: { customerId: id } })

  if (contractCount > 0) {
    return {
      error: `This customer has ${contractCount} contract(s) and cannot be deleted.`,
    }
  }

  const customer = await db.customer.delete({ where: { id } })

  await logAudit({
    user,
    action: 'DELETE',
    entityType: 'Customer',
    entityId: customer.id,
    entityLabel: customer.name,
  })

  revalidatePath('/customers')
  redirect('/customers')
}
