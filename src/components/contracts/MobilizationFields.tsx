'use client'

import { useEffect, useRef } from 'react'
import { parseDateInput } from '@/lib/dates'
import {
  chargeByRule,
  MOBILIZATION_CHARGE_LABELS,
  MOBILIZATION_CHARGES,
} from '@/lib/mobilization'
import { Combobox } from '@/components/ui/Combobox'
import { Field, inputClass } from '@/components/ui/form'

/**
 * Mobilization block, shared by the create and edit forms.
 *
 * The charge follows a rule — a month or more is free, under a month is
 * charged — so the default is "follow the rule" rather than a value copied in
 * at creation. Editing the closing date then moves the answer with it instead
 * of leaving a stale one behind. Choosing an explicit value overrides the rule
 * and is stored.
 */
export function MobilizationFields({
  mobilizedByOptions,
  mobilizationDate,
  closingDate,
  charge,
  onChargeChange,
  initial,
  errors,
}: {
  mobilizedByOptions: { value: string; label: string }[]
  mobilizationDate: string
  closingDate: string
  charge: string
  onChargeChange: (value: string) => void
  initial: {
    quotationRef: string
    mobilizationBy: string
    mobilizationAmount: string
  }
  errors: Record<string, string>
}) {
  const chargeRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (chargeRef.current) chargeRef.current.value = charge
  })

  const start = parseDateInput(mobilizationDate)
  const end = parseDateInput(closingDate)

  const ruleSays = start
    ? chargeByRule({ mobilizationDate: start, closingDate: end })
    : null

  const effective = charge === '' ? ruleSays : charge
  const showAmount = effective === 'CHARGED'

  return (
    <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h2 className="font-semibold">Mobilization</h2>
        <p className="mt-1 text-sm text-slate-500">
          A contract running a month or more mobilizes free of charge; under a
          month it is charged.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Quotation reference"
          htmlFor="quotationRef"
          hint="One quotation can cover several contracts."
        >
          <input
            id="quotationRef"
            name="quotationRef"
            defaultValue={initial.quotationRef}
            className={inputClass}
          />
        </Field>

        <Field
          label="Mobilized by"
          htmlFor="mobilizationBy"
          hint="Type any name — suggestions grow as you use them."
        >
          <Combobox
            name="mobilizationBy"
            options={mobilizedByOptions}
            defaultValue={initial.mobilizationBy}
            placeholder="e.g. own yard, Al Nasr Transport"
            allowCustom
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Charge" htmlFor="mobilizationCharge">
          <select
            id="mobilizationCharge"
            name="mobilizationCharge"
            ref={chargeRef}
            defaultValue={charge}
            onChange={(event) => onChargeChange(event.target.value)}
            className={inputClass}
          >
            <option value="">
              Follow the duration rule
              {ruleSays ? ` (${MOBILIZATION_CHARGE_LABELS[ruleSays]})` : ''}
            </option>
            {MOBILIZATION_CHARGES.map((value) => (
              <option key={value} value={value}>
                {MOBILIZATION_CHARGE_LABELS[value]} — override
              </option>
            ))}
          </select>
          {errors.mobilizationCharge && (
            <p className="mt-1 text-xs text-red-600">
              {errors.mobilizationCharge}
            </p>
          )}
        </Field>

        <div className={showAmount ? undefined : 'hidden'}>
          <Field
            label="Mobilization amount (QAR)"
            htmlFor="mobilizationAmount"
            hint="From the quotation. Leave blank until it is known."
          >
            <input
              id="mobilizationAmount"
              name="mobilizationAmount"
              inputMode="decimal"
              defaultValue={initial.mobilizationAmount}
              className={inputClass}
            />
            {errors.mobilizationAmount && (
              <p className="mt-1 text-xs text-red-600">
                {errors.mobilizationAmount}
              </p>
            )}
          </Field>
        </div>
      </div>

      {ruleSays && charge === '' && (
        <p className="text-xs text-slate-500">
          {end
            ? `Closing ${closingDate} — the rule makes this ${MOBILIZATION_CHARGE_LABELS[
                ruleSays
              ].toLowerCase()}.`
            : 'No closing date, so this counts as a month or more — free of charge.'}
        </p>
      )}
    </section>
  )
}
