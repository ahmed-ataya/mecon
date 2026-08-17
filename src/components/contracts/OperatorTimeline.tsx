'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import {
  hasAssignmentEnded,
  isAssignmentUpcoming,
} from '@/lib/contract-status'
import { formatDate, toDateInputValue } from '@/lib/dates'
import {
  ARRANGEMENTS,
  ARRANGEMENT_LABELS,
  ASSIGNMENT_REASON_LABELS,
  OPERATOR_ASSIGNMENT_REASONS,
  type Arrangement,
} from '@/lib/enums'
import { formatQar, toRiyalInput } from '@/lib/money'
import type { OperatorOption } from '@/lib/contract-options'
import { replaceOperator } from '@/lib/actions/contracts'
import { Combobox } from '@/components/ui/Combobox'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import { WarningList } from './WarningList'

export type OperatorAssignmentRow = {
  id: string
  startDate: Date
  endDate: Date | null
  reason: string
  note: string | null
  arrangement: string
  operatorHourlyCost: number | null
  operator: { id: string; name: string } | null
}

/**
 * Operator assignment history. Same close-and-open rule as the equipment
 * timeline — when someone is off sick the old assignment is closed the day
 * before the replacement starts, never overwritten.
 */
export function OperatorTimeline({
  assignments,
  operatorOptions,
  siteRegime,
  currentMachineType,
}: {
  assignments: OperatorAssignmentRow[]
  operatorOptions: OperatorOption[]
  siteRegime: string
  /** The machine currently on this contract, if any — Phase B4/F5: TPC/QE
   * coverage is per machine type, so eligibility for a replacement operator
   * depends on which machine they'd actually be running. */
  currentMachineType: string | null
}) {
  const [replacing, setReplacing] = useState<string | null>(null)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="font-semibold">Operator</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {assignments.length}{' '}
          {assignments.length === 1 ? 'assignment' : 'assignments'} on record —
          one at a time, replaced as people change
        </p>
      </div>

      <ol className="space-y-3">
        {assignments.map((assignment) => {
          const ended = hasAssignmentEnded(assignment)
          const planned = isAssignmentUpcoming(assignment)
          // Replaceable while it is running or still to come — not once ended.
          const current = !ended
          // Margin is the contract's combined rate minus this cost, so it is
          // shown on the contract rather than here.

          return (
            <li
              key={assignment.id}
              className={`rounded-md border p-4 ${
                ended
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {assignment.operator?.name ?? 'Without operator'}
                    </span>
                    {ended ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
                        Ended
                      </span>
                    ) : planned ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-inset ring-sky-200">
                        Planned
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 ring-1 ring-inset ring-green-200">
                        Current
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {ARRANGEMENT_LABELS[
                        assignment.arrangement as Arrangement
                      ] ?? assignment.arrangement}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {ASSIGNMENT_REASON_LABELS[assignment.reason] ??
                        assignment.reason}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(assignment.startDate)} –{' '}
                    {assignment.endDate
                      ? formatDate(assignment.endDate)
                      : 'ongoing'}
                  </p>

                  {assignment.operatorHourlyCost !== null && (
                    <p className="mt-1 text-xs text-slate-500">
                      We pay {formatQar(assignment.operatorHourlyCost)}/hr
                    </p>
                  )}

                  {assignment.note && (
                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.note}
                    </p>
                  )}
                </div>

                {current && (
                  <button
                    type="button"
                    onClick={() =>
                      setReplacing((id) =>
                        id === assignment.id ? null : assignment.id,
                      )
                    }
                    className={buttonSecondaryClass}
                  >
                    {replacing === assignment.id ? 'Cancel' : 'Replace'}
                  </button>
                )}
              </div>

              {replacing === assignment.id && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    Replace{' '}
                    {assignment.operator?.name ?? 'this arrangement'}
                  </p>
                  <p className="mb-4 text-xs text-slate-500">
                    The current assignment will be closed the day before the
                    replacement starts, keeping billing continuous.
                  </p>
                  <OperatorAssignmentForm
                    action={replaceOperator.bind(null, assignment.id)}
                    operatorOptions={operatorOptions}
                    siteRegime={siteRegime}
                    currentMachineType={currentMachineType}
                    defaultArrangement={assignment.arrangement as Arrangement}
                    defaultReason="SICK_INJURED"
                    defaultHourlyCost={assignment.operatorHourlyCost}
                    minDate={assignment.startDate}
                    submitLabel="Replace operator"
                    onDone={() => setReplacing(null)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Shared by "Add operator" and "Replace" — the parent binds the action. */
function OperatorAssignmentForm({
  action,
  operatorOptions,
  siteRegime,
  currentMachineType,
  defaultArrangement,
  defaultReason,
  defaultHourlyCost,
  minDate,
  submitLabel,
  onDone,
}: {
  action: (
    state: { errors?: Record<string, string> },
    formData: FormData,
  ) => Promise<{ errors?: Record<string, string> }>
  operatorOptions: OperatorOption[]
  siteRegime: string
  currentMachineType: string | null
  defaultArrangement: Arrangement
  defaultReason: string
  defaultHourlyCost: number | null
  minDate?: Date
  submitLabel: string
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  const [arrangement, setArrangement] = useState<Arrangement>(
    defaultArrangement,
  )
  const [reason, setReason] = useState(defaultReason)
  const [operatorId, setOperatorId] = useState('')

  const settled = useRef(state)
  useEffect(() => {
    if (settled.current !== state && !state.errors) onDone()
    settled.current = state
  }, [state, onDone])

  const needsOperator = arrangement !== 'WITHOUT_OPERATOR'
  const isMarket = arrangement === 'MARKET_OPERATOR'

  const selectedOperator = operatorOptions.find((o) => o.value === operatorId)
  const eligibilityWarnings = needsOperator
    ? (selectedOperator?.siteWarnings[siteRegime]?.[currentMachineType ?? ''] ?? [])
    : []

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={errors.form} />

      <WarningList
        warnings={eligibilityWarnings}
        title="Before you replace"
        footer="These do not prevent replacing — resolve them separately."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Arrangement" htmlFor="arrangement">
          <Select
            name="arrangement"
            options={ARRANGEMENTS.map((value) => ({
              value,
              label: ARRANGEMENT_LABELS[value],
            }))}
            defaultValue={arrangement}
            onSelect={(value) => setArrangement(value as Arrangement)}
          />
        </Field>

        <Field label="Reason" htmlFor="reason">
          <Select
            name="reason"
            options={OPERATOR_ASSIGNMENT_REASONS.map((value) => ({
              value,
              label: ASSIGNMENT_REASON_LABELS[value] ?? value,
            }))}
            defaultValue={reason}
            onSelect={setReason}
          />
        </Field>
      </div>

      {needsOperator && (
        <Field label="New operator" htmlFor="operatorId">
          <Combobox
            name="operatorId"
            options={operatorOptions}
            onSelect={setOperatorId}
            placeholder="Search operators…"
          />
          {errors.operatorId && (
            <p className="mt-1 text-xs text-red-600">{errors.operatorId}</p>
          )}
        </Field>
      )}

      <Field
        label="Start date"
        htmlFor="startDate"
        hint={
          minDate
            ? `Must be after ${formatDate(minDate)}.`
            : 'When this operator starts.'
        }
      >
        <input
          id="startDate"
          name="startDate"
          type="date"
          min={minDate ? toDateInputValue(minDate) : undefined}
          className={inputClass}
        />
        {errors.startDate && (
          <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>
        )}
      </Field>

      {isMarket && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Operator cost (QAR/hour)" htmlFor="operatorHourlyCost">
            <input
              id="operatorHourlyCost"
              name="operatorHourlyCost"
              inputMode="decimal"
              defaultValue={toRiyalInput(defaultHourlyCost)}
              className={inputClass}
            />
          </Field>

        </div>
      )}

      <Field label="Note" htmlFor="note">
        <input id="note" name="note" className={inputClass} />
      </Field>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <button type="button" onClick={onDone} className={buttonSecondaryClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
