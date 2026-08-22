'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import {
  LEAVE_TYPE_LABELS,
  REQUESTABLE_LEAVE_TYPES,
} from '@/lib/enums'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { LeaveRequestActionState } from '@/lib/actions/leave'
import { createLeaveRequest } from '@/lib/actions/leave'

export function LeaveRequestForm({
  employeeOptions,
  defaultEmployeeId,
  cancelHref,
}: {
  employeeOptions: ComboboxOption[]
  defaultEmployeeId?: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState<
    LeaveRequestActionState,
    FormData
  >(createLeaveRequest, {})
  const errors = state.errors ?? {}
  const values = state.values

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <FormError message={errors.form} />

      <Field label="Employee" htmlFor="employeeId">
        <Combobox
          name="employeeId"
          options={employeeOptions}
          defaultValue={values?.employeeId ?? defaultEmployeeId ?? ''}
          placeholder="Search employees…"
        />
        {errors.employeeId && (
          <p className="mt-1 text-xs text-red-600">{errors.employeeId}</p>
        )}
      </Field>

      <Field label="Leave type" htmlFor="leaveType">
        <Select
          name="leaveType"
          options={REQUESTABLE_LEAVE_TYPES.map((value) => ({
            value,
            label: LEAVE_TYPE_LABELS[value],
          }))}
          defaultValue={values?.leaveType ?? 'ANNUAL'}
        />
        {errors.leaveType && (
          <p className="mt-1 text-xs text-red-600">{errors.leaveType}</p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="startDate">
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={values?.startDate}
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
            defaultValue={values?.endDate}
            className={inputClass}
          />
          {errors.endDate && (
            <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>
          )}
        </Field>
      </div>

      <Field
        label="Pay treatment"
        htmlFor="paidOverride"
        hint="Sick leave always uses its own tiered pay rule regardless of this. For every other type, blank follows the type's default."
      >
        <Select
          name="paidOverride"
          placeholder="Use type default"
          options={[
            { value: 'true', label: 'Paid' },
            { value: 'false', label: 'Unpaid' },
          ]}
          defaultValue={values?.paidOverride ?? ''}
        />
      </Field>

      <Field label="Note" htmlFor="note">
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={values?.note}
          className={inputClass}
        />
      </Field>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Submitting…' : 'Submit request'}
        </button>
        <Link href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
