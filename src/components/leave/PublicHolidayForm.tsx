'use client'

import { useActionState } from 'react'
import type { PublicHolidayActionState } from '@/lib/actions/leave'
import { createPublicHoliday } from '@/lib/actions/leave'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  inputClass,
} from '@/components/ui/form'

export function PublicHolidayForm() {
  const [state, formAction, pending] = useActionState<
    PublicHolidayActionState,
    FormData
  >(createPublicHoliday, {})
  const errors = state.errors ?? {}

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <FormError message={errors.form} />

      <Field label="Name" htmlFor="name">
        <input
          id="name"
          name="name"
          defaultValue={state.values?.name}
          placeholder="Eid Al Fitr"
          className={inputClass}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="startDate">
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={state.values?.startDate}
            className={inputClass}
          />
          {errors.startDate && (
            <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>
          )}
        </Field>

        <Field label="End date" htmlFor="endDate">
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={state.values?.endDate}
            className={inputClass}
          />
          {errors.endDate && (
            <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>
          )}
        </Field>
      </div>

      <button type="submit" disabled={pending} className={buttonPrimaryClass}>
        {pending ? 'Adding…' : 'Add public holiday'}
      </button>
    </form>
  )
}
