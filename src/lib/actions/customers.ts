'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { customerSchema, fieldErrors } from '../validation'

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
  const values = readCustomerForm(formData)
  const parsed = customerSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const customer = await db.customer.create({ data: parsed.data })

  revalidatePath('/customers')
  redirect(`/customers/${customer.id}`)
}

export async function updateCustomer(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readCustomerForm(formData)
  const parsed = customerSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  await db.customer.update({ where: { id }, data: parsed.data })

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  redirect(`/customers/${id}`)
}

export async function deleteCustomer(id: string) {
  // Documents cascade with the customer. Contracts do not — a customer with
  // contract history must not be silently removed, so this refuses instead.
  const contractCount = await db.contract.count({ where: { customerId: id } })

  if (contractCount > 0) {
    return {
      error: `This customer has ${contractCount} contract(s) and cannot be deleted.`,
    }
  }

  await db.customer.delete({ where: { id } })

  revalidatePath('/customers')
  redirect('/customers')
}
