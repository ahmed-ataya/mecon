'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { Equipment } from '@prisma/client'
import { EQUIPMENT_TYPES } from '@/lib/enums'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/equipment'

/** Shared by the new and edit pages — the parent binds the right action. */
export function EquipmentForm({
  action,
  equipment,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  equipment?: Equipment
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // After a failed submit, fall back to what was typed rather than to the
  // stored record — otherwise React's post-action form reset discards it.
  const values = state.values
  const initial = {
    name: values?.name ?? equipment?.name ?? '',
    type: values?.type ?? equipment?.type ?? EQUIPMENT_TYPES[0],
    serialNumber: values?.serialNumber ?? equipment?.serialNumber ?? '',
    plateNumber: values?.plateNumber ?? equipment?.plateNumber ?? '',
    notes: values?.notes ?? equipment?.notes ?? '',
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={errors.form} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Unit label"
          htmlFor="name"
          hint="How the yard refers to it, e.g. CAT 320 #4"
        >
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

        <Field label="Type" htmlFor="type">
          <select
            id="type"
            name="type"
            defaultValue={initial.type}
            className={inputClass}
          >
            {EQUIPMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type && (
            <p className="mt-1 text-xs text-red-600">{errors.type}</p>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Serial number" htmlFor="serialNumber">
          <input
            id="serialNumber"
            name="serialNumber"
            defaultValue={initial.serialNumber}
            className={inputClass}
          />
        </Field>

        <Field label="Plate number" htmlFor="plateNumber">
          <input
            id="plateNumber"
            name="plateNumber"
            defaultValue={initial.plateNumber}
            className={inputClass}
          />
        </Field>
      </div>

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
