'use client'

import { useEffect, useRef, useState } from 'react'
import {
  RATE_TYPES,
  RATE_TYPE_HOURS,
  RATE_TYPE_LABELS,
  type RateType,
} from '@/lib/enums'
import { formatAmountExact, hourlyRate, parseQar } from '@/lib/money'
import { Field, inputClass } from '@/components/ui/form'

/**
 * The rate type and amount, with the hourly rate they come to shown underneath.
 *
 * The readout is the point. Everything bills in hours, so the agreed figure is
 * divided by 260, 60 or 10 before it ever reaches an invoice — and that
 * conversion is invisible at the moment of typing. A rate of 28.85 entered
 * against "per week" is 48 halalas an hour, which nobody would agree to and
 * nobody would notice until the invoice came out at QAR 91.
 *
 * So it is spelled out live, along with what a full month would come to, which
 * is the figure people can sanity-check against.
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

  // React's post-action form reset drops both values: it applies them as
  // properties, never as the `selected`/`value` attributes a reset reads. So
  // they are re-applied after every commit, the same way the site regime and
  // arrangement selects are. See NOTES.md.
  const typeRef = useRef<HTMLSelectElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (typeRef.current) typeRef.current.value = rateType
    if (amountRef.current) amountRef.current.value = amount
  })

  const halalas = parseQar(amount)
  const perHour =
    typeof halalas === 'number' && halalas > 0
      ? hourlyRate(halalas, RATE_TYPE_HOURS[rateType] ?? 1)
      : null

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rate type" htmlFor="rateType">
          <select
            id="rateType"
            name="rateType"
            ref={typeRef}
            defaultValue={initialType}
            onChange={(event) => setRateType(event.target.value as RateType)}
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
            ref={amountRef}
            inputMode="decimal"
            defaultValue={defaultRateAmount ?? ''}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </Field>
      </div>

      {perHour !== null && (
        <p className="rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
          Bills at{' '}
          <span className="font-medium text-slate-900">
            QAR {formatAmountExact(perHour)} an hour
          </span>{' '}
          — QAR {formatAmountExact(perHour * RATE_TYPE_HOURS.PER_MONTH)} for a
          full month of 260 hours. Every invoice is billed in hours, whatever
          the rate was agreed in.
        </p>
      )}
    </>
  )
}
