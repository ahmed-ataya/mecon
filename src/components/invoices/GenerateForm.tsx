'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { formatDate } from '@/lib/dates'
import { Combobox } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/invoices'
import type { PartyOption } from '@/lib/contract-options'

export type ContractChoice = {
  id: string
  projectName: string
  siteName: string
  customerId: string
  lpoId: string | null
  lpoNumber: string | null
  machineName: string | null
  mobilizationDate: Date
  closingDate: Date | null
}

/**
 * Generates draft invoices for a period.
 *
 * Defaults reflect how the work is actually done: one invoice per contract
 * (which is one machine), because a dispute over one machine must not hold up
 * payment on the others. Combining is available because customers ask for it,
 * but it is a deliberate tick rather than the default.
 */
export function GenerateForm({
  action,
  customers,
  contracts,
  defaultStart,
  defaultEnd,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  contracts: ContractChoice[]
  defaultStart: string
  defaultEnd: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const values = state.values ?? {}

  const [customerId, setCustomerId] = useState(values.customerId ?? '')
  const [selected, setSelected] = useState<string[]>([])
  const [combine, setCombine] = useState(false)

  const forCustomer = contracts.filter(
    (contract) => contract.customerId === customerId,
  )

  const chosen = forCustomer.filter((contract) => selected.includes(contract.id))
  const lpoIds = [...new Set(chosen.map((contract) => contract.lpoId))]
  const mixedLpos = combine && lpoIds.length > 1

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={errors.form} />

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Customer and period</h2>

        <Field label="Customer" htmlFor="customerId">
          <Combobox
            name="customerId"
            options={customers}
            defaultValue={customerId}
            placeholder="Search customers…"
            onSelect={(value) => {
              setCustomerId(value)
              setSelected([])
            }}
          />
          {errors.customerId && (
            <p className="mt-1 text-xs text-red-600">{errors.customerId}</p>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Period start" htmlFor="periodStart">
            <input
              id="periodStart"
              name="periodStart"
              type="date"
              defaultValue={values.periodStart ?? defaultStart}
              className={inputClass}
            />
            {errors.periodStart && (
              <p className="mt-1 text-xs text-red-600">{errors.periodStart}</p>
            )}
          </Field>

          <Field label="Period end" htmlFor="periodEnd">
            <input
              id="periodEnd"
              name="periodEnd"
              type="date"
              defaultValue={values.periodEnd ?? defaultEnd}
              className={inputClass}
            />
            {errors.periodEnd && (
              <p className="mt-1 text-xs text-red-600">{errors.periodEnd}</p>
            )}
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-md bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200">
          <input
            type="checkbox"
            name="splitMonthly"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-800">
              One invoice per calendar month
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              A hire from 1 Aug to 15 Oct becomes an August, a September and a
              part-October invoice. Leave unticked for a single invoice covering
              the whole span.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">Contracts to bill</h2>
          <p className="mt-1 text-sm text-slate-500">
            One contract is one machine. Pick the ones to invoice for this
            period.
          </p>
        </div>

        {!customerId ? (
          <p className="text-sm text-slate-500">Pick a customer first.</p>
        ) : forCustomer.length === 0 ? (
          <p className="text-sm text-slate-500">
            This customer has no contracts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {forCustomer.map((contract) => (
              <label
                key={contract.id}
                className="flex items-start gap-3 rounded-md border border-slate-200 px-4 py-3"
              >
                <input
                  type="checkbox"
                  name="contractIds"
                  value={contract.id}
                  checked={selected.includes(contract.id)}
                  onChange={() => toggle(contract.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-slate-900">
                    {contract.projectName}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {contract.machineName ?? 'No machine assigned'} ·{' '}
                    {contract.siteName} · mobilized{' '}
                    {formatDate(contract.mobilizationDate)}
                    {contract.lpoNumber
                      ? ` · LPO ${contract.lpoNumber}`
                      : ' · no LPO'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {errors.contractIds && (
          <p className="text-xs text-red-600">{errors.contractIds}</p>
        )}

        {selected.length > 1 && (
          <label className="flex items-start gap-3 rounded-md bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-200">
            <input
              type="checkbox"
              name="combine"
              checked={combine}
              onChange={(event) => setCombine(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-amber-900">
              <span className="font-medium">
                Combine all {selected.length} onto one invoice
              </span>
              <span className="mt-0.5 block text-xs">
                Only if the customer has asked. If they dispute one machine,
                payment on every machine on this invoice is held up — which is
                why separate invoices are the default.
              </span>
            </span>
          </label>
        )}

        {mixedLpos && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            Those contracts are on different LPOs, so they cannot share one
            invoice — the form carries a single “Your Order No.”.
          </p>
        )}
        {errors.combine && (
          <p className="text-xs text-red-600">{errors.combine}</p>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">Mobilization</h2>
          <p className="mt-1 text-sm text-slate-500">
            Both print at the bottom of the invoice. Mobilization normally goes
            on the first invoice and de-mobilization on the last — but a short
            hire often bills de-mob up front.
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="includeMobilization"
            className="h-4 w-4 rounded border-slate-300"
          />
          Include mobilization charge
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="includeDemobilization"
            className="h-4 w-4 rounded border-slate-300"
          />
          Include de-mobilization charge
        </label>

        <p className="text-xs text-slate-500">
          A contract that mobilizes free of charge adds no line and says so
          rather than silently doing nothing.
        </p>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Generating…' : 'Generate drafts'}
        </button>
        <Link href="/invoices" className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        Everything is created as a draft. Nothing counts against an LPO, and
        nothing is frozen, until you issue it.
      </p>
    </form>
  )
}
