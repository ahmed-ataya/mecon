'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { Customer } from '@prisma/client'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/customers'

/** Shared by the new and edit pages — the parent binds the right action. */
export function CustomerForm({
  action,
  customer,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customer?: Customer
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // After a failed submit, fall back to what was typed rather than to the
  // stored record — otherwise React's post-action form reset discards it.
  const values = state.values
  const initial = {
    name: values?.name ?? customer?.name ?? '',
    contactPerson: values?.contactPerson ?? customer?.contactPerson ?? '',
    phone: values?.phone ?? customer?.phone ?? '',
    email: values?.email ?? customer?.email ?? '',
    notes: values?.notes ?? customer?.notes ?? '',
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={errors.form} />

      <Field label="Customer name" htmlFor="name">
        <input
          id="name"
          name="name"
          defaultValue={initial.name}
          className={inputClass}
          autoFocus
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Contact person" htmlFor="contactPerson">
          <input
            id="contactPerson"
            name="contactPerson"
            defaultValue={initial.contactPerson}
            className={inputClass}
          />
        </Field>

        <Field label="Phone" htmlFor="phone">
          <input
            id="phone"
            name="phone"
            defaultValue={initial.phone}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={initial.email}
          className={inputClass}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email}</p>
        )}
      </Field>

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial.notes}
          className={inputClass}
        />
      </Field>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
