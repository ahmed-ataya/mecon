'use client'

import { useActionState } from 'react'
import type { RamadanActionState } from '@/lib/actions/ramadan'
import { createRamadanPeriod } from '@/lib/actions/ramadan'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  inputClass,
} from '@/components/ui/form'

export function RamadanPeriodForm() {
  const [state, formAction, pending] = useActionState<RamadanActionState, FormData>(
    createRamadanPeriod,
    {},
  )
  const errors = state.errors ?? {}

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <FormError message={errors.form} />

      <Field label="Year" htmlFor="year">
        <input
          id="year"
          name="year"
          inputMode="numeric"
          defaultValue={state.values?.year}
          className={inputClass}
        />
        {errors.year && <p className="mt-1 text-xs text-red-600">{errors.year}</p>}
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
        {pending ? 'Adding…' : 'Add Ramadan period'}
      </button>
    </form>
  )
}
