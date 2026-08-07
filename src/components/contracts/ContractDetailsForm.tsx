'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import type { Contract } from '@prisma/client'
import { SITES, SITE_LABELS } from '@/lib/enums'
import { toDateInputValue } from '@/lib/dates'
import { toRiyalInput } from '@/lib/money'
import type { PartyOption } from '@/lib/contract-options'
import type { ActionState } from '@/lib/actions/contracts'
import { Combobox } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import { WarningList } from './WarningList'

/**
 * Edits the contract (the project) only.
 *
 * Assignments are deliberately not editable here — changing a machine has to
 * go through Replace on the contract page so the outgoing assignment is closed
 * rather than overwritten. Editing one in place would destroy the billing
 * history the whole design exists to protect.
 */
export function ContractDetailsForm({
  action,
  customers,
  contract,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  contract: Contract
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const values = state.values ?? {}

  const [customerId, setCustomerId] = useState(
    values.customerId ?? contract.customerId,
  )
  const [site, setSite] = useState(values.site ?? contract.site)

  // Selects lose their value to React's post-action form reset — see NOTES.md.
  const siteRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (siteRef.current) siteRef.current.value = site
  })

  const selectedCustomer = customers.find((c) => c.value === customerId)

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={errors.form} />

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <Field label="Customer" htmlFor="customerId">
          <Combobox
            name="customerId"
            options={customers}
            defaultValue={customerId}
            placeholder="Search customers…"
            onSelect={setCustomerId}
          />
          {errors.customerId && (
            <p className="mt-1 text-xs text-red-600">{errors.customerId}</p>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Project name" htmlFor="projectName">
            <input
              id="projectName"
              name="projectName"
              defaultValue={values.projectName ?? contract.projectName}
              className={inputClass}
            />
            {errors.projectName && (
              <p className="mt-1 text-xs text-red-600">{errors.projectName}</p>
            )}
          </Field>

          <Field label="Site" htmlFor="site">
            <select
              id="site"
              name="site"
              ref={siteRef}
              defaultValue={site}
              onChange={(event) => setSite(event.target.value)}
              className={inputClass}
            >
              {SITES.map((value) => (
                <option key={value} value={value}>
                  {SITE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Mobilization date"
            htmlFor="mobilizationDate"
            hint="Changing this re-dates the project itself — it is not how you record a machine swap."
          >
            <input
              id="mobilizationDate"
              name="mobilizationDate"
              type="date"
              defaultValue={
                values.mobilizationDate ??
                toDateInputValue(contract.mobilizationDate)
              }
              className={inputClass}
            />
            {errors.mobilizationDate && (
              <p className="mt-1 text-xs text-red-600">
                {errors.mobilizationDate}
              </p>
            )}
          </Field>

          <Field
            label="Closing date"
            htmlFor="closingDate"
            hint="Leave blank while the contract is ongoing."
          >
            <input
              id="closingDate"
              name="closingDate"
              type="date"
              defaultValue={
                values.closingDate ?? toDateInputValue(contract.closingDate)
              }
              className={inputClass}
            />
            {errors.closingDate && (
              <p className="mt-1 text-xs text-red-600">{errors.closingDate}</p>
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">LPO</h2>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="LPO number" htmlFor="lpoNumber">
            <input
              id="lpoNumber"
              name="lpoNumber"
              defaultValue={values.lpoNumber ?? contract.lpoNumber ?? ''}
              className={inputClass}
            />
          </Field>

          <Field label="LPO validity" htmlFor="lpoValidity">
            <input
              id="lpoValidity"
              name="lpoValidity"
              type="date"
              defaultValue={
                values.lpoValidity ?? toDateInputValue(contract.lpoValidity)
              }
              className={inputClass}
            />
          </Field>

          <Field label="LPO amount (QAR)" htmlFor="lpoAmount">
            <input
              id="lpoAmount"
              name="lpoAmount"
              inputMode="decimal"
              defaultValue={values.lpoAmount ?? toRiyalInput(contract.lpoAmount)}
              className={inputClass}
            />
            {errors.lpoAmount && (
              <p className="mt-1 text-xs text-red-600">{errors.lpoAmount}</p>
            )}
          </Field>
        </div>
      </section>

      <WarningList
        warnings={selectedCustomer?.warnings ?? []}
        title="Customer document warnings"
      />

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <Link href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
