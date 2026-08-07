'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import {
  ARRANGEMENTS,
  ARRANGEMENT_LABELS,
  RATE_TYPES,
  RATE_TYPE_LABELS,
  SITES,
  SITE_LABELS,
  type Arrangement,
} from '@/lib/enums'
import type { EquipmentOption, PartyOption } from '@/lib/contract-options'
import type { Warning } from '@/lib/warnings'
import { Combobox } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/contracts'
import { WarningList } from './WarningList'

/**
 * Create-contract form.
 *
 * The contract carries the project: customer, site, and a mobilization date
 * that is fixed for its lifetime. The first machine and the operator
 * arrangement are created alongside it, both starting on the mobilization
 * date, because a contract with nothing on it is not a useful record.
 *
 * Warnings recompute as selections change and never block submission.
 */
export function ContractForm({
  action,
  customers,
  equipment,
  operators,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  equipment: EquipmentOption[]
  operators: PartyOption[]
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const values = state.values ?? {}

  const [customerId, setCustomerId] = useState(values.customerId ?? '')
  const [equipmentId, setEquipmentId] = useState(values.equipmentId ?? '')
  const [operatorId, setOperatorId] = useState(values.operatorId ?? '')
  const [site, setSite] = useState(values.site ?? SITES[0])
  const [arrangement, setArrangement] = useState<Arrangement>(
    (values.arrangement as Arrangement) ?? 'WITH_OPERATOR',
  )

  // A <select> loses its value to React's post-action form reset — it applies
  // the value as a property, never as the `selected` attribute a reset reads.
  // See NOTES.md.
  const siteRef = useRef<HTMLSelectElement>(null)
  const arrangementRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (siteRef.current) siteRef.current.value = site
    if (arrangementRef.current) arrangementRef.current.value = arrangement
  })

  const selectedCustomer = customers.find((c) => c.value === customerId)
  const selectedEquipment = equipment.find((e) => e.value === equipmentId)
  const selectedOperator = operators.find((o) => o.value === operatorId)

  const needsOperator = arrangement !== 'WITHOUT_OPERATOR'
  const isMarketOperator = arrangement === 'MARKET_OPERATOR'

  const liveWarnings: Warning[] = [
    ...(selectedCustomer?.warnings ?? []),
    ...(selectedEquipment?.warnings ?? []),
    ...(needsOperator ? (selectedOperator?.warnings ?? []) : []),
  ]

  const siteWarning = selectedEquipment?.siteWarnings[site] ?? null
  if (siteWarning) liveWarnings.push(siteWarning)

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={errors.form} />

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Project</h2>

        <Field
          label="Customer"
          htmlFor="customerId"
          hint="Type to filter. Document status is shown on each option."
        >
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
              defaultValue={values.projectName ?? ''}
              className={inputClass}
            />
            {errors.projectName && (
              <p className="mt-1 text-xs text-red-600">{errors.projectName}</p>
            )}
          </Field>

          <Field
            label="Site"
            htmlFor="site"
            hint="Drives which 3rd party certificates are acceptable."
          >
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
            hint="Belongs to the project — it never changes when a machine is swapped."
          >
            <input
              id="mobilizationDate"
              name="mobilizationDate"
              type="date"
              defaultValue={values.mobilizationDate ?? ''}
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
              defaultValue={values.closingDate ?? ''}
              className={inputClass}
            />
            {errors.closingDate && (
              <p className="mt-1 text-xs text-red-600">{errors.closingDate}</p>
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">First machine</h2>
          <p className="mt-1 text-sm text-slate-500">
            Starts on the mobilization date. More machines can be added, and
            this one replaced, from the contract page — the history is kept
            either way.
          </p>
        </div>

        <Field label="Equipment" htmlFor="equipmentId">
          <Combobox
            name="equipmentId"
            options={equipment}
            defaultValue={equipmentId}
            placeholder="Search equipment…"
            onSelect={setEquipmentId}
          />
          {errors.equipmentId && (
            <p className="mt-1 text-xs text-red-600">{errors.equipmentId}</p>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Rate type" htmlFor="rateType">
            <select
              id="rateType"
              name="rateType"
              defaultValue={values.rateType ?? RATE_TYPES[0]}
              className={inputClass}
            >
              {RATE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {RATE_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Rate (QAR)"
            htmlFor="rateAmount"
            hint="Decimals are fine — 137.50 is stored exactly."
          >
            <input
              id="rateAmount"
              name="rateAmount"
              inputMode="decimal"
              defaultValue={values.rateAmount ?? ''}
              className={inputClass}
            />
            {errors.rateAmount && (
              <p className="mt-1 text-xs text-red-600">{errors.rateAmount}</p>
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Operator</h2>

        <Field label="Arrangement" htmlFor="arrangement">
          <select
            id="arrangement"
            name="arrangement"
            ref={arrangementRef}
            defaultValue={arrangement}
            onChange={(event) =>
              setArrangement(event.target.value as Arrangement)
            }
            className={inputClass}
          >
            {ARRANGEMENTS.map((value) => (
              <option key={value} value={value}>
                {ARRANGEMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        {needsOperator && (
          <Field label="Operator" htmlFor="operatorId">
            <Combobox
              name="operatorId"
              options={operators}
              defaultValue={operatorId}
              placeholder="Search operators…"
              onSelect={setOperatorId}
            />
            {errors.operatorId && (
              <p className="mt-1 text-xs text-red-600">{errors.operatorId}</p>
            )}
          </Field>
        )}

        {isMarketOperator && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Operator cost (QAR)"
              htmlFor="operatorCost"
              hint="What we pay the subcontracted operator."
            >
              <input
                id="operatorCost"
                name="operatorCost"
                inputMode="decimal"
                defaultValue={values.operatorCost ?? ''}
                className={inputClass}
              />
              {errors.operatorCost && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.operatorCost}
                </p>
              )}
            </Field>

            <Field
              label="Operator rebill (QAR)"
              htmlFor="operatorRebill"
              hint="What we charge the customer. Both are kept so margin is visible."
            >
              <input
                id="operatorRebill"
                name="operatorRebill"
                inputMode="decimal"
                defaultValue={values.operatorRebill ?? ''}
                className={inputClass}
              />
              {errors.operatorRebill && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.operatorRebill}
                </p>
              )}
            </Field>
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">LPO</h2>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="LPO number" htmlFor="lpoNumber">
            <input
              id="lpoNumber"
              name="lpoNumber"
              defaultValue={values.lpoNumber ?? ''}
              className={inputClass}
            />
          </Field>

          <Field label="LPO validity" htmlFor="lpoValidity">
            <input
              id="lpoValidity"
              name="lpoValidity"
              type="date"
              defaultValue={values.lpoValidity ?? ''}
              className={inputClass}
            />
          </Field>

          <Field label="LPO amount (QAR)" htmlFor="lpoAmount">
            <input
              id="lpoAmount"
              name="lpoAmount"
              inputMode="decimal"
              defaultValue={values.lpoAmount ?? ''}
              className={inputClass}
            />
            {errors.lpoAmount && (
              <p className="mt-1 text-xs text-red-600">{errors.lpoAmount}</p>
            )}
          </Field>
        </div>
      </section>

      <WarningList warnings={liveWarnings} title="Before you save" />

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : 'Create contract'}
        </button>
        <Link href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
