'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { Lpo } from '@prisma/client'
import { toDateInputValue } from '@/lib/dates'
import { toRiyalInput } from '@/lib/money'
import { getLpoOpenness, LPO_OPENNESS_LABELS } from '@/lib/lpo'
import { parseDateInput } from '@/lib/dates'
import type { PartyOption } from '@/lib/contract-options'
import type { ActionState } from '@/lib/actions/lpos'
import { Combobox } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'

/**
 * Add/edit an LPO.
 *
 * Amount and expiry are BOTH optional, and leaving either blank is a
 * deliberate record of an open LPO rather than an unfinished form. The panel
 * below the fields says which kind you are creating as you type, so "open" is
 * never something you discover later.
 */
export function LpoForm({
  action,
  customers,
  lpo,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  lpo?: Lpo
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const values = state.values ?? {}

  const initial = {
    customerId: values.customerId ?? lpo?.customerId ?? '',
    number: values.number ?? lpo?.number ?? '',
    amount: values.amount ?? toRiyalInput(lpo?.amount),
    validity: values.validity ?? toDateInputValue(lpo?.validity),
    notes: values.notes ?? lpo?.notes ?? '',
  }

  const [amount, setAmount] = useState(initial.amount)
  const [validity, setValidity] = useState(initial.validity)

  // Mirrors the server-side derivation in lib/lpo.ts so the label cannot
  // disagree with what actually gets saved.
  const openness = getLpoOpenness({
    amount: amount.trim() === '' ? null : 1,
    validity: validity.trim() === '' ? null : parseDateInput(validity),
  })

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={errors.form} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Customer" htmlFor="customerId">
          <Combobox
            name="customerId"
            options={customers}
            defaultValue={initial.customerId}
            placeholder="Search customers…"
          />
          {errors.customerId && (
            <p className="mt-1 text-xs text-red-600">{errors.customerId}</p>
          )}
        </Field>

        <Field label="LPO number" htmlFor="number">
          <input
            id="number"
            name="number"
            defaultValue={initial.number}
            className={inputClass}
          />
          {errors.number && (
            <p className="mt-1 text-xs text-red-600">{errors.number}</p>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Amount (QAR)"
          htmlFor="amount"
          hint="Leave blank for an open amount — no ceiling agreed."
        >
          <input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
          />
          {errors.amount && (
            <p className="mt-1 text-xs text-red-600">{errors.amount}</p>
          )}
        </Field>

        <Field
          label="Expiry"
          htmlFor="validity"
          hint="Leave blank for an open expiry — no end date agreed."
        >
          <input
            id="validity"
            name="validity"
            type="date"
            value={validity}
            onChange={(event) => setValidity(event.target.value)}
            className={inputClass}
          />
          {errors.validity && (
            <p className="mt-1 text-xs text-red-600">{errors.validity}</p>
          )}
        </Field>
      </div>

      <div className="rounded-md bg-slate-50 px-4 py-3 text-sm ring-1 ring-inset ring-slate-200">
        <p className="font-medium text-slate-800">
          This is {openness === 'NORMAL' ? 'a' : 'an'}{' '}
          {LPO_OPENNESS_LABELS[openness].toLowerCase()} LPO
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {openness === 'NORMAL'
            ? 'Both a ceiling and an expiry are recorded.'
            : openness === 'OPEN_AMOUNT'
              ? 'No ceiling — invoicing is not capped against this LPO.'
              : openness === 'OPEN_EXPIRY'
                ? 'No end date — it will never raise an expiry warning.'
                : 'No ceiling and no end date.'}
        </p>
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
