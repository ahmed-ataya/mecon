'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import {
  hasAssignmentEnded,
  isAssignmentUpcoming,
} from '@/lib/contract-status'
import { formatDate, toDateInputValue } from '@/lib/dates'
import {
  ASSIGNMENT_REASON_LABELS,
  EQUIPMENT_ASSIGNMENT_REASONS,
} from '@/lib/enums'
import { toRiyalInput } from '@/lib/money'
import { describeRate } from '@/lib/rates'
import type { EquipmentOption, OperatorOption } from '@/lib/contract-options'
import { replaceEquipment } from '@/lib/actions/contracts'
import { Combobox } from '@/components/ui/Combobox'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import { RateFields } from './RateFields'
import { WarningList } from './WarningList'

export type EquipmentAssignmentRow = {
  id: string
  startDate: Date
  endDate: Date | null
  reason: string
  note: string | null
  rateType: string
  rateAmount: number
  equipment: { id: string; name: string; type: string }
}

/**
 * The assignment history for one contract, oldest first.
 *
 * Replacing never edits the row it replaces: the outgoing assignment is closed
 * the day before the new one starts and a new row is opened, so the contract
 * keeps a continuous, auditable record of which machine was on site on any
 * given day. That is what phase 3 bills from.
 */
export function EquipmentTimeline({
  assignments,
  equipmentOptions,
  siteRegime,
  currentOperator,
}: {
  assignments: EquipmentAssignmentRow[]
  equipmentOptions: EquipmentOption[]
  siteRegime: string
  /** Whoever is currently assigned to operate on this contract, if anyone —
   * Phase B4/F5: swapping the machine can invalidate their existing TPC/QE
   * coverage (issued for a different machine type), so replacing equipment
   * needs the same live eligibility check replacing the operator already
   * gets, just checked against the machine instead of the person. */
  currentOperator: OperatorOption | null
}) {
  const [replacing, setReplacing] = useState<string | null>(null)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="font-semibold">Machine</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {assignments.length}{' '}
          {assignments.length === 1 ? 'assignment' : 'assignments'} on record —
          one at a time, replaced as machines change
        </p>
      </div>

      <ol className="space-y-3">
        {assignments.map((assignment) => {
          const ended = hasAssignmentEnded(assignment)
          const planned = isAssignmentUpcoming(assignment)
          // Replaceable while it is running or still to come — not once ended.
          const current = !ended

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
                      {assignment.equipment.name}
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
                      {ASSIGNMENT_REASON_LABELS[assignment.reason] ??
                        assignment.reason}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(assignment.startDate)} –{' '}
                    {assignment.endDate
                      ? formatDate(assignment.endDate)
                      : 'ongoing'}
                    <span className="text-slate-400">
                      {' · '}
                      {describeRate(assignment.rateAmount, assignment.rateType)}
                    </span>
                  </p>

                  {assignment.note && (
                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.note}
                    </p>
                  )}
                </div>

                {current && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplacing((id) =>
                        id === assignment.id ? null : assignment.id,
                      )
                    }}
                    className={buttonSecondaryClass}
                  >
                    {replacing === assignment.id ? 'Cancel' : 'Replace'}
                  </button>
                )}
              </div>

              {replacing === assignment.id && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    Replace {assignment.equipment.name}
                  </p>
                  <p className="mb-4 text-xs text-slate-500">
                    {assignment.equipment.name} will be closed the day before
                    the replacement starts. The contract and its mobilization
                    date are untouched, so billing stays continuous.
                  </p>
                  <AssignmentForm
                    action={replaceEquipment.bind(null, assignment.id)}
                    equipmentOptions={equipmentOptions}
                    siteRegime={siteRegime}
                    currentOperator={currentOperator}
                    submitLabel="Replace machine"
                    defaultReason="BREAKDOWN_REPLACEMENT"
                    defaultRateType={assignment.rateType}
                    defaultRateAmount={assignment.rateAmount}
                    minDate={assignment.startDate}
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

function AssignmentForm({
  action,
  equipmentOptions,
  siteRegime,
  currentOperator,
  submitLabel,
  defaultReason,
  defaultRateType,
  defaultRateAmount,
  minDate,
  onDone,
}: {
  action: (
    state: { errors?: Record<string, string> },
    formData: FormData,
  ) => Promise<{ errors?: Record<string, string> }>
  equipmentOptions: EquipmentOption[]
  siteRegime: string
  currentOperator: OperatorOption | null
  submitLabel: string
  defaultReason: string
  defaultRateType?: string
  defaultRateAmount?: number
  minDate?: Date
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const [reason, setReason] = useState(defaultReason)
  const [equipmentId, setEquipmentId] = useState('')

  // Close once the server reports success (no errors came back).
  const settled = useRef(state)
  useEffect(() => {
    if (settled.current !== state && !state.errors) onDone()
    settled.current = state
  }, [state, onDone])

  const selectedMachine = equipmentOptions.find((e) => e.value === equipmentId)
  // Phase B4/F5: the current operator's TPC/QE has to cover whichever
  // machine ends up here, not the one being replaced. '' before a machine
  // is picked falls back to "any machine" rather than guessing wrong.
  const eligibilityWarnings =
    currentOperator?.siteWarnings[siteRegime]?.[selectedMachine?.type ?? ''] ?? []

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={errors.form} />

      <WarningList
        warnings={eligibilityWarnings}
        title="Before you replace"
        footer="These do not prevent replacing — resolve them separately."
      />

      <Field label="New machine" htmlFor="equipmentId">
        <Combobox
          name="equipmentId"
          options={equipmentOptions}
          onSelect={setEquipmentId}
          placeholder="Search equipment…"
        />
        {errors.equipmentId && (
          <p className="mt-1 text-xs text-red-600">{errors.equipmentId}</p>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start date"
          htmlFor="startDate"
          hint={
            minDate
              ? `Must be after ${formatDate(minDate)}.`
              : 'When this machine starts working.'
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

        <Field label="Reason" htmlFor="reason">
          <Select
            name="reason"
            options={EQUIPMENT_ASSIGNMENT_REASONS.map((value) => ({
              value,
              label: ASSIGNMENT_REASON_LABELS[value] ?? value,
            }))}
            defaultValue={reason}
            onSelect={setReason}
          />
        </Field>
      </div>

      <RateFields
        defaultRateType={defaultRateType}
        defaultRateAmount={toRiyalInput(defaultRateAmount)}
        error={errors.rateAmount}
      />

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
