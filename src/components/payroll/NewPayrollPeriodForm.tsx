'use client'

import { useActionState } from 'react'
import { monthLabel } from '@/lib/timesheet'
import type { CreatePeriodActionState } from '@/lib/actions/payroll'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
} from '@/components/ui/form'

export function NewPayrollPeriodForm({
  action,
  defaultYear,
  defaultMonth,
  cancelHref,
}: {
  action: (
    state: CreatePeriodActionState,
    formData: FormData,
  ) => Promise<CreatePeriodActionState>
  defaultYear: number
  defaultMonth: number
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // A handful of years around today — payroll periods are never entered far
  // from the present.
  const yearChoices = [defaultYear - 1, defaultYear, defaultYear + 1]
  const monthChoices = Array.from({ length: 12 }, (_, index) => index + 1)

  return (
    <form action={formAction} className="max-w-md space-y-5">
      <FormError message={errors.form} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Month" htmlFor="month">
          <Select
            name="month"
            options={monthChoices.map((month) => ({
              value: String(month),
              label: monthLabel(defaultYear, month).split(' ')[0],
            }))}
            defaultValue={String(defaultMonth)}
          />
        </Field>

        <Field label="Year" htmlFor="year">
          <Select
            name="year"
            options={yearChoices.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
            defaultValue={String(defaultYear)}
          />
        </Field>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Generating…' : 'Create payroll period'}
        </button>
        <a href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </a>
      </div>
    </form>
  )
}
