'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import type { Contract } from '@prisma/client'
import { SITES, SITE_LABELS } from '@/lib/enums'
import { toDateInputValue } from '@/lib/dates'
import { toRiyalInput } from '@/lib/money'
import type {
  LocationOption,
  LpoOption,
  PartyOption,
} from '@/lib/contract-options'
import type { ActionState } from '@/lib/actions/contracts'
import { Combobox } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import { MobilizationFields } from './MobilizationFields'
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
  locations,
  lpos,
  mobilizedByOptions,
  contract,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  locations: LocationOption[]
  lpos: LpoOption[]
  mobilizedByOptions: { value: string; label: string }[]
  contract: Contract
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const values = state.values ?? {}

  const [customerId, setCustomerId] = useState(
    values.customerId ?? contract.customerId,
  )
  const [siteRegime, setSiteRegime] = useState(
    values.siteRegime ?? contract.siteRegime,
  )

  // Selects lose their value to React's post-action form reset — see NOTES.md.
  const siteRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (siteRef.current) siteRef.current.value = siteRegime
  })

  const [mobilizationDate, setMobilizationDate] = useState(
    values.mobilizationDate ?? toDateInputValue(contract.mobilizationDate),
  )
  const [closingDate, setClosingDate] = useState(
    values.closingDate ?? toDateInputValue(contract.closingDate),
  )
  const [mobilizationCharge, setMobilizationCharge] = useState(
    values.mobilizationCharge ?? contract.mobilizationCharge ?? '',
  )

  const selectedCustomer = customers.find((c) => c.value === customerId)
  const lpoChoices = customerId
    ? lpos.filter((lpo) => lpo.customerId === customerId)
    : lpos

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

        <Field
          label="Location"
          htmlFor="siteName"
          hint="Type any location. Suggestions come from places already used."
        >
          <Combobox
            name="siteName"
            options={locations}
            defaultValue={values.siteName ?? contract.siteName}
            placeholder="e.g. Barzan Onshore"
            allowCustom
            onSelect={(value) => {
              const known = locations.find(
                (l) => l.value.toLowerCase() === value.trim().toLowerCase(),
              )
              if (known) setSiteRegime(known.regime)
            }}
          />
          {errors.siteName && (
            <p className="mt-1 text-xs text-red-600">{errors.siteName}</p>
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

          <Field
            label="Certification applies"
            htmlFor="siteRegime"
            hint="Which regime's 3rd party certificates this location accepts."
          >
            <select
              id="siteRegime"
              name="siteRegime"
              ref={siteRef}
              defaultValue={siteRegime}
              onChange={(event) => setSiteRegime(event.target.value)}
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
              value={mobilizationDate}
              onChange={(event) => setMobilizationDate(event.target.value)}
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
              value={closingDate}
              onChange={(event) => setClosingDate(event.target.value)}
              className={inputClass}
            />
            {errors.closingDate && (
              <p className="mt-1 text-xs text-red-600">{errors.closingDate}</p>
            )}
          </Field>
        </div>
      </section>

      <MobilizationFields
        mobilizedByOptions={mobilizedByOptions}
        mobilizationDate={mobilizationDate}
        closingDate={closingDate}
        charge={mobilizationCharge}
        onChargeChange={setMobilizationCharge}
        initial={{
          quotationRef: values.quotationRef ?? contract.quotationRef ?? '',
          mobilizationBy: values.mobilizationBy ?? contract.mobilizationBy ?? '',
          mobilizationAmount:
            values.mobilizationAmount ?? toRiyalInput(contract.mobilizationAmount),
        }}
        errors={errors}
      />

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">LPO</h2>
          <p className="mt-1 text-sm text-slate-500">
            A shared record — one LPO can cover several contracts.
          </p>
        </div>

        <Field label="LPO" htmlFor="lpoId">
          <Combobox
            name="lpoId"
            options={lpoChoices}
            defaultValue={values.lpoId ?? contract.lpoId ?? ''}
            placeholder="Search this customer’s LPOs…"
            emptyLabel="No LPOs for this customer yet"
          />
        </Field>
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
