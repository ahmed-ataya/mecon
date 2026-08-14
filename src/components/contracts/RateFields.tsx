'use client'

import { useEffect, useRef, useState } from 'react'
import {
  RATE_TYPES,
  RATE_TYPE_HOURS,
  RATE_TYPE_LABELS,
  RATE_TYPE_PERIOD_LABELS,
  type RateType,
} from '@/lib/enums'
import { formatAmountExact, parseQar, periodTotal } from '@/lib/money'
import { Select } from '@/components/ui/Select'
import { Field, inputClass } from '@/components/ui/form'

/**
 * The hourly rate and the arrangement it sits under, with what a full period
 * comes to shown underneath.
 *
 * The rate is hourly because that is the figure the invoice prints and the
 * office already works in. The arrangement — daily, weekly, monthly — is a
 * term of the agreement and changes no arithmetic.
 *
 * The readout runs the other way, multiplying up to the period total, because
 * that is the number a person recognises: "28.85 an hour" means little on its
 * own, "7,501 for a full month" is instantly either right or absurd.
 */
export function RateFields({
  defaultRateType,
  defaultRateAmount,
  error,
}: {
  defaultRateType?: string
  /** Riyals as typed, not halalas — "1375.50". */
  defaultRateAmount?: string
  error?: string
}) {
  const initialType = (defaultRateType as RateType) ?? RATE_TYPES[0]

  // State drives the READOUT only; the fields themselves stay uncontrolled, so
  // the contract form's draft restore (which remounts the <form> and re-creates
  // uncontrolled inputs from their defaults) keeps working untouched.
  const [rateType, setRateType] = useState<RateType>(initialType)
  const [amount, setAmount] = useState(defaultRateAmount ?? '')

  // React's post-action form reset drops the rate value: it is applied as a
  // property, never as the `value` attribute a reset reads. Re-applied after
  // every commit. See NOTES.md. The arrangement picker (Select) handles its
  // own equivalent of this internally.
  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (amountRef.current) amountRef.current.value = amount
  })

  const perHour = parseQar(amount)
  // Fallback covers a rateType read back from older data that is no longer in
  // the list — the readout degrades rather than rendering "undefined hours".
  const hoursInPeriod = RATE_TYPE_HOURS[rateType] ?? RATE_TYPE_HOURS.PER_MONTH

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hire arrangement" htmlFor="rateType">
          <Select
            name="rateType"
            options={RATE_TYPES.map((value) => ({
              value,
              label: RATE_TYPE_LABELS[value],
            }))}
            defaultValue={initialType}
            onSelect={(value) => setRateType(value as RateType)}
          />
        </Field>

        <Field
          label="Hourly rate (QAR)"
          htmlFor="rateAmount"
          hint="What the customer pays per hour. Decimals are fine — 137.50 is stored exactly."
        >
          <input
            id="rateAmount"
            name="rateAmount"
            ref={amountRef}
            inputMode="decimal"
            defaultValue={defaultRateAmount ?? ''}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </Field>
      </div>

      {typeof perHour === 'number' && perHour > 0 && (
        <p className="rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
          QAR {formatAmountExact(perHour)} an hour comes to{' '}
          <span className="font-medium text-slate-900">
            QAR {formatAmountExact(periodTotal(perHour, hoursInPeriod))} for a
            full {RATE_TYPE_PERIOD_LABELS[rateType]}
          </span>{' '}
          of {hoursInPeriod} hours. Invoices bill the hours actually worked, so
          a part period is simply fewer of them.
        </p>
      )}
    </>
  )
}
