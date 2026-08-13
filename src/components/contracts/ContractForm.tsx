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
  LpoOption,
  PartyOption,
} from '@/lib/contract-options'
import type { Warning } from '@/lib/warnings'
import { Combobox } from '@/components/ui/Combobox'
import {
  ErrorSummary,
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/contracts'
import { timeAgo, useFormDraft } from '@/lib/use-form-draft'
import { MobilizationFields } from './MobilizationFields'
import { WarningList } from './WarningList'

/**
 * Create-contract form.
 *
 * ONE contract, ONE machine — three machines on a job means three contracts.
 * The machine and the operator both start on the mobilization date, and either
 * can be replaced later from the contract page, which keeps the history.
 *
 * The LPO is a shared record picked here rather than typed in: one LPO commonly
 * covers several machines, so repeating its details on each contract would let
 * them drift apart.
 *
 * Warnings recompute as selections change and never block submission.
 */
export function ContractForm({
  action,
  customers,
  equipment,
  operators,
  locations,
  lpos,
  mobilizedByOptions,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  equipment: EquipmentOption[]
  operators: PartyOption[]
  locations: LocationOption[]
  lpos: LpoOption[]
  mobilizedByOptions: { value: string; label: string }[]
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // An unfinished form is kept in the browser, not the database — see
  // use-form-draft.ts. A restored draft is fed in through the SAME `values`
  // path an error echo uses, so every field picks it up without special cases.
  const draft = useFormDraft('mecon:contract-draft')
  const [restored, setRestored] = useState<Record<string, string> | null>(null)
  const [formGeneration, setFormGeneration] = useState(0)

  const values = state.values ?? restored ?? {}

  const [customerId, setCustomerId] = useState(values.customerId ?? '')
  const [siteRegime, setSiteRegime] = useState(values.siteRegime ?? SITES[0])
  const [equipmentId, setEquipmentId] = useState(values.equipmentId ?? '')
  const [operatorId, setOperatorId] = useState(values.operatorId ?? '')
  const [arrangement, setArrangement] = useState<Arrangement>(
    (values.arrangement as Arrangement) ?? 'WITH_OPERATOR',
  )
  const [mobilizationDate, setMobilizationDate] = useState(
    values.mobilizationDate ?? '',
  )
  const [closingDate, setClosingDate] = useState(values.closingDate ?? '')
  const [mobilizationCharge, setMobilizationCharge] = useState(
    values.mobilizationCharge ?? '',
  )

  // Selects lose their value to React's post-action form reset — it applies the
  // value as a property, never as the `selected` attribute a reset reads.
  // See NOTES.md.
  const regimeRef = useRef<HTMLSelectElement>(null)
  const arrangementRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (regimeRef.current) regimeRef.current.value = siteRegime
    if (arrangementRef.current) arrangementRef.current.value = arrangement
  })

  /**
   * Remounting the <form> re-creates the uncontrolled inputs from `values`,
   * but this component's OWN state does not re-run its initialisers — the key
   * is on the form element, not on the component. So the controlled fields are
   * set explicitly here. Missing this restored the project name but silently
   * left the customer and dates blank.
   */
  function restoreDraft(saved: Record<string, string>) {
    setRestored(saved)
    setCustomerId(saved.customerId ?? '')
    setSiteRegime(saved.siteRegime ?? SITES[0])
    setEquipmentId(saved.equipmentId ?? '')
    setOperatorId(saved.operatorId ?? '')
    setArrangement((saved.arrangement as Arrangement) ?? 'WITH_OPERATOR')
    setMobilizationDate(saved.mobilizationDate ?? '')
    setClosingDate(saved.closingDate ?? '')
    setMobilizationCharge(saved.mobilizationCharge ?? '')
    setFormGeneration((current) => current + 1)
  }

  const selectedCustomer = customers.find((c) => c.value === customerId)
  const selectedMachine = equipment.find((e) => e.value === equipmentId)
  const selectedOperator = operators.find((o) => o.value === operatorId)

  const needsOperator = arrangement !== 'WITHOUT_OPERATOR'
  const isMarketOperator = arrangement === 'MARKET_OPERATOR'

  // Only this customer's LPOs — an LPO belongs to whoever issued it.
  const lpoChoices = customerId
    ? lpos.filter((lpo) => lpo.customerId === customerId)
    : lpos

  const liveWarnings: Warning[] = [
    ...(selectedCustomer?.warnings ?? []),
    ...(selectedMachine?.warnings ?? []),
    ...(needsOperator ? (selectedOperator?.warnings ?? []) : []),
  ]

  const siteWarning = selectedMachine?.siteWarnings[siteRegime] ?? null
  if (siteWarning) liveWarnings.push(siteWarning)

  return (
    <form
      key={formGeneration}
      action={formAction}
      // Remounting re-runs every field's initial state from `values`, which is
      // how a restored draft reaches the comboboxes and selects.
      onInput={(event) => draft.save(event.currentTarget)}
      onSubmit={(event) => draft.save(event.currentTarget)}
      className="space-y-6"
    >
      <FormError message={errors.form} />

      {draft.found && !restored && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-sky-50 px-4 py-3 text-sm ring-1 ring-inset ring-sky-200">
          <span className="text-sky-900">
            You have an unfinished contract from{' '}
            <span className="font-medium">{timeAgo(draft.found.savedAt)}</span>.
          </span>
          <button
            type="button"
            onClick={() => restoreDraft(draft.found!.values)}
            className="rounded-md bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-800"
          >
            Restore it
          </button>
          <button
            type="button"
            onClick={draft.clear}
            className="text-xs text-sky-800 underline hover:text-sky-950"
          >
            Discard
          </button>
        </div>
      )}
      <ErrorSummary
        errors={errors}
        shown={[
          'customerId',
          'projectName',
          'siteName',
          'siteRegime',
          'mobilizationDate',
          'closingDate',
          'equipmentId',
          'rateAmount',
          'operatorId',
          'lpoId',
          'mobilizationCharge',
          'mobilizationAmount',
        ]}
      />

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
                // certification rule is not re-decided each time.
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
            hint="Belongs to the project — it never changes when the machine is swapped."
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

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">Machine</h2>
          <p className="mt-1 text-sm text-slate-500">
            One machine per contract. It starts on the mobilization date and can
            be replaced later without disturbing the contract.
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
              label="Operator cost (QAR/hour)"
              htmlFor="operatorHourlyCost"
              hint="Per hour. Overtime is this times the multiplier."
            >
              <input
                id="operatorHourlyCost"
                name="operatorHourlyCost"
                inputMode="decimal"
                defaultValue={values.operatorHourlyCost ?? ''}
                className={inputClass}
              />
            </Field>

          </div>
        )}
      </section>

      <MobilizationFields
        mobilizedByOptions={mobilizedByOptions}
        mobilizationDate={mobilizationDate}
        closingDate={closingDate}
        charge={mobilizationCharge}
        onChargeChange={setMobilizationCharge}
        initial={{
          quotationRef: values.quotationRef ?? '',
          mobilizationBy: values.mobilizationBy ?? '',
          mobilizationAmount: values.mobilizationAmount ?? '',
        }}
        errors={errors}
      />

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">LPO</h2>
          <p className="mt-1 text-sm text-slate-500">
            One LPO can cover several machines, so it is a shared record. Leave
            blank if the LPO has not arrived yet.
          </p>
        </div>

        <Field label="LPO" htmlFor="lpoId">
          <Combobox
            name="lpoId"
            options={lpoChoices}
            defaultValue={values.lpoId ?? ''}
            placeholder={
              customerId
                ? 'Search this customer’s LPOs…'
                : 'Pick a customer first…'
            }
            emptyLabel="No LPOs for this customer yet — add one from the LPOs page"
          />
          {errors.lpoId && (
            <p className="mt-1 text-xs text-red-600">{errors.lpoId}</p>
          )}
        </Field>
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
