'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { Operator } from '@prisma/client'
import { OPERATOR_SOURCES, OPERATOR_SOURCE_LABELS } from '@/lib/enums'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/operators'

/** Shared by the new and edit pages — the parent binds the right action. */
export function OperatorForm({
  action,
  operator,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  operator?: Operator
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // After a failed submit, fall back to what was typed rather than to the
  // stored record — otherwise React's post-action form reset discards it.
  const values = state.values
  const initial = {
    name: values?.name ?? operator?.name ?? '',
    phone: values?.phone ?? operator?.phone ?? '',
    nationality: values?.nationality ?? operator?.nationality ?? '',
    source: values?.source ?? operator?.source ?? OPERATOR_SOURCES[0],
    notes: values?.notes ?? operator?.notes ?? '',
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={errors.form} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Operator name" htmlFor="name">
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

        <Field
          label="Source"
          htmlFor="source"
          hint="Market operators are subcontracted and re-billed to the customer."
        >
          <Select
            name="source"
            options={OPERATOR_SOURCES.map((source) => ({
              value: source,
              label: OPERATOR_SOURCE_LABELS[source],
            }))}
            defaultValue={initial.source}
          />
          {errors.source && (
            <p className="mt-1 text-xs text-red-600">{errors.source}</p>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone">
          <input
            id="phone"
            name="phone"
            defaultValue={initial.phone}
            className={inputClass}
          />
        </Field>

        <Field label="Nationality" htmlFor="nationality">
          <input
            id="nationality"
            name="nationality"
            defaultValue={initial.nationality}
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
