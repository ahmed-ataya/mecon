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
import type {
  EquipmentOption,
  LocationOption,
  PartyOption,
} from '@/lib/contract-options'
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

type MachineRow = {
  key: number
  equipmentId: string
  rateType: string
  rateAmount: string
}

type OperatorRow = {
  key: number
  arrangement: Arrangement
  operatorId: string
  equipmentId: string
  operatorCost: string
  operatorRebill: string
}

let nextKey = 1

/**
 * Create-contract form.
 *
 * The contract carries the project: customer, location, and a mobilization
 * date fixed for its lifetime. Machines and operators are entered as
 * repeatable rows — a contract can run several of each at once, at different
 * rates — and all start on the mobilization date.
 *
 * Every row renders every field, hidden ones included, because the action
 * reads them back as parallel arrays and misaligned indexes would silently
 * mix rows together.
 *
 * Warnings recompute as selections change and never block submission.
 */
export function ContractForm({
  action,
  customers,
  equipment,
  operators,
  locations,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  equipment: EquipmentOption[]
  operators: PartyOption[]
  locations: LocationOption[]
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const values = state.values ?? {}

  const [customerId, setCustomerId] = useState(values.customerId ?? '')
  const [siteRegime, setSiteRegime] = useState(values.siteRegime ?? SITES[0])

  const [machines, setMachines] = useState<MachineRow[]>([
    { key: 0, equipmentId: '', rateType: RATE_TYPES[0], rateAmount: '' },
  ])
  const [operatorRows, setOperatorRows] = useState<OperatorRow[]>([
    {
      key: 0,
      arrangement: 'WITH_OPERATOR',
      operatorId: '',
      equipmentId: '',
      operatorCost: '',
      operatorRebill: '',
    },
  ])

  // A <select> loses its value to React's post-action form reset — it applies
  // the value as a property, never as the `selected` attribute a reset reads.
  // See NOTES.md.
  const regimeRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (regimeRef.current) regimeRef.current.value = siteRegime
  })

  const selectedCustomer = customers.find((c) => c.value === customerId)

  const liveWarnings: Warning[] = [...(selectedCustomer?.warnings ?? [])]

  for (const row of machines) {
    const machine = equipment.find((e) => e.value === row.equipmentId)
    if (!machine) continue

    liveWarnings.push(...machine.warnings)
    const siteWarning = machine.siteWarnings[siteRegime]
    if (siteWarning) liveWarnings.push(siteWarning)
  }

  for (const row of operatorRows) {
    if (row.arrangement === 'WITHOUT_OPERATOR') continue
    const operator = operators.find((o) => o.value === row.operatorId)
    if (operator) liveWarnings.push(...operator.warnings)
  }

  // Machines already picked, so an operator can be tied to one of them.
  const machineChoices = machines
    .map((row) => equipment.find((e) => e.value === row.equipmentId))
    .filter((machine): machine is EquipmentOption => !!machine)
    .map((machine) => ({
      value: machine.value,
      label: machine.label,
      sublabel: machine.sublabel,
    }))

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

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Location"
            htmlFor="siteName"
            hint="Type any location — suggestions come from places already used."
          >
            <Combobox
              name="siteName"
              options={locations}
              defaultValue={values.siteName ?? ''}
              placeholder="e.g. Barzan Onshore"
              allowCustom
              onSelect={(value) => {
                // A known location carries its regime forward, so the
                // certification rule does not have to be re-decided each time.
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

          <Field
            label="Certification applies"
            htmlFor="siteRegime"
            hint="Which regime's 3rd party certificates this location accepts."
          >
            <select
              id="siteRegime"
              name="siteRegime"
              ref={regimeRef}
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

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Machines</h2>
            <p className="mt-1 text-sm text-slate-500">
              All start on the mobilization date. Each carries its own rate.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setMachines((rows) => [
                ...rows,
                {
                  key: nextKey++,
                  equipmentId: '',
                  rateType: RATE_TYPES[0],
                  rateAmount: '',
                },
              ])
            }
            className={buttonSecondaryClass}
          >
            Add machine
          </button>
        </div>

        {errors.m_equipmentId && (
          <p className="text-xs text-red-600">{errors.m_equipmentId}</p>
        )}

        {machines.map((row, index) => (
          <div
            key={row.key}
            className="space-y-4 rounded-md border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Machine {index + 1}
              </span>
              {machines.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setMachines((rows) => rows.filter((r) => r.key !== row.key))
                  }
                  className="text-xs text-slate-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>

            <Field label="Equipment" htmlFor={`m_equipmentId_${row.key}`}>
              <Combobox
                name="m_equipmentId"
                options={equipment}
                defaultValue={row.equipmentId}
                placeholder="Search equipment…"
                onSelect={(value) =>
                  setMachines((rows) =>
                    rows.map((r) =>
                      r.key === row.key ? { ...r, equipmentId: value } : r,
                    ),
                  )
                }
              />
              {errors[`m_equipmentId_${index}`] && (
                <p className="mt-1 text-xs text-red-600">
                  {errors[`m_equipmentId_${index}`]}
                </p>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rate type" htmlFor={`m_rateType_${row.key}`}>
                <select
                  id={`m_rateType_${row.key}`}
                  name="m_rateType"
                  defaultValue={row.rateType}
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
                htmlFor={`m_rateAmount_${row.key}`}
                hint="Decimals are fine — 137.50 is stored exactly."
              >
                <input
                  id={`m_rateAmount_${row.key}`}
                  name="m_rateAmount"
                  inputMode="decimal"
                  defaultValue={row.rateAmount}
                  className={inputClass}
                />
                {errors[`m_rateAmount_${index}`] && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors[`m_rateAmount_${index}`]}
                  </p>
                )}
              </Field>
            </div>

            <input type="hidden" name="m_note" value="" readOnly />
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Operators</h2>
            <p className="mt-1 text-sm text-slate-500">
              One per machine is typical. Each can name the machine it runs.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setOperatorRows((rows) => [
                ...rows,
                {
                  key: nextKey++,
                  arrangement: 'WITH_OPERATOR',
                  operatorId: '',
                  equipmentId: '',
                  operatorCost: '',
                  operatorRebill: '',
                },
              ])
            }
            className={buttonSecondaryClass}
          >
            Add operator
          </button>
        </div>

        {operatorRows.map((row, index) => (
          <OperatorRowFields
            key={row.key}
            row={row}
            index={index}
            operators={operators}
            machineChoices={machineChoices}
            errors={errors}
            removable={operatorRows.length > 1}
            onChange={(patch) =>
              setOperatorRows((rows) =>
                rows.map((r) => (r.key === row.key ? { ...r, ...patch } : r)),
              )
            }
            onRemove={() =>
              setOperatorRows((rows) => rows.filter((r) => r.key !== row.key))
            }
          />
        ))}
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

function OperatorRowFields({
  row,
  index,
  operators,
  machineChoices,
  errors,
  removable,
  onChange,
  onRemove,
}: {
  row: OperatorRow
  index: number
  operators: PartyOption[]
  machineChoices: { value: string; label: string; sublabel?: string }[]
  errors: Record<string, string>
  removable: boolean
  onChange: (patch: Partial<OperatorRow>) => void
  onRemove: () => void
}) {
  const arrangementRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (arrangementRef.current) arrangementRef.current.value = row.arrangement
  })

  const needsOperator = row.arrangement !== 'WITHOUT_OPERATOR'
  const isMarket = row.arrangement === 'MARKET_OPERATOR'

  return (
    <div className="space-y-4 rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Operator {index + 1}
        </span>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-slate-500 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Arrangement" htmlFor={`o_arrangement_${row.key}`}>
          <select
            id={`o_arrangement_${row.key}`}
            name="o_arrangement"
            ref={arrangementRef}
            defaultValue={row.arrangement}
            onChange={(event) =>
              onChange({ arrangement: event.target.value as Arrangement })
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

        <Field
          label="Runs which machine"
          htmlFor={`o_equipmentId_${row.key}`}
          hint="Optional — leave blank if not tied to one machine."
        >
          <Combobox
            name="o_equipmentId"
            options={machineChoices}
            defaultValue={row.equipmentId}
            placeholder={
              machineChoices.length === 0
                ? 'Pick machines above first'
                : 'Search machines on this contract…'
            }
            emptyLabel="No machines chosen yet"
            onSelect={(value) => onChange({ equipmentId: value })}
          />
        </Field>
      </div>

      {/* Rendered even when hidden so the parallel arrays stay aligned. */}
      <div className={needsOperator ? undefined : 'hidden'}>
        <Field label="Operator" htmlFor={`o_operatorId_${row.key}`}>
          <Combobox
            name="o_operatorId"
            options={operators}
            defaultValue={row.operatorId}
            placeholder="Search operators…"
            onSelect={(value) => onChange({ operatorId: value })}
          />
          {errors[`o_operatorId_${index}`] && (
            <p className="mt-1 text-xs text-red-600">
              {errors[`o_operatorId_${index}`]}
            </p>
          )}
        </Field>
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 ${isMarket ? '' : 'hidden'}`}>
        <Field
          label="Operator cost (QAR)"
          htmlFor={`o_operatorCost_${row.key}`}
          hint="What we pay the subcontracted operator."
        >
          <input
            id={`o_operatorCost_${row.key}`}
            name="o_operatorCost"
            inputMode="decimal"
            defaultValue={row.operatorCost}
            className={inputClass}
          />
        </Field>

        <Field
          label="Operator rebill (QAR)"
          htmlFor={`o_operatorRebill_${row.key}`}
          hint="What we charge the customer. Both kept so margin is visible."
        >
          <input
            id={`o_operatorRebill_${row.key}`}
            name="o_operatorRebill"
            inputMode="decimal"
            defaultValue={row.operatorRebill}
            className={inputClass}
          />
        </Field>
      </div>

      <input type="hidden" name="o_note" value="" readOnly />
    </div>
  )
}
