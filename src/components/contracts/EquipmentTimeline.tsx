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
  RATE_TYPES,
  RATE_TYPE_LABELS,
  type RateType,
} from '@/lib/enums'
import { formatQar, toRiyalInput } from '@/lib/money'
import type { EquipmentOption } from '@/lib/contract-options'
import { addEquipmentAssignment, replaceEquipment } from '@/lib/actions/contracts'
import { Combobox } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'

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
  contractId,
  assignments,
  equipmentOptions,
}: {
  contractId: string
  assignments: EquipmentAssignmentRow[]
  equipmentOptions: EquipmentOption[]
}) {
  const [replacing, setReplacing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Equipment</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {assignments.length}{' '}
            {assignments.length === 1 ? 'assignment' : 'assignments'} on record
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding((open) => !open)
            setReplacing(null)
          }}
          className={buttonSecondaryClass}
        >
          {adding ? 'Cancel' : 'Add machine'}
        </button>
      </div>

      {adding && (
        <div className="mb-5 rounded-md border border-slate-200 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Add another machine
          </p>
          <p className="mb-4 text-xs text-slate-500">
            This runs alongside the existing machines. To swap one out instead,
            use Replace on that row so its history is closed properly.
          </p>
          <AssignmentForm
            action={addEquipmentAssignment.bind(null, contractId)}
            equipmentOptions={equipmentOptions}
            submitLabel="Add machine"
            defaultReason="INITIAL"
            onDone={() => setAdding(false)}
          />
        </div>
      )}

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
                      {formatQar(assignment.rateAmount)}{' '}
                      {RATE_TYPE_LABELS[
                        assignment.rateType as RateType
                      ]?.toLowerCase() ?? assignment.rateType}
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
                      setAdding(false)
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

  // Selects lose their value to React's post-action form reset — see NOTES.md.
  const reasonRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (reasonRef.current) reasonRef.current.value = reason
  })

  // Close once the server reports success (no errors came back).
  const settled = useRef(state)
  useEffect(() => {
    if (settled.current !== state && !state.errors) onDone()
    settled.current = state
  }, [state, onDone])

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={errors.form} />

      <Field label="New machine" htmlFor="equipmentId">
        <Combobox
          name="equipmentId"
          options={equipmentOptions}
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
          <select
            id="reason"
            name="reason"
            ref={reasonRef}
            defaultValue={reason}
            onChange={(event) => setReason(event.target.value)}
            className={inputClass}
          >
            {EQUIPMENT_ASSIGNMENT_REASONS.map((value) => (
              <option key={value} value={value}>
                {ASSIGNMENT_REASON_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rate type" htmlFor="rateType">
          <select
            id="rateType"
            name="rateType"
            defaultValue={defaultRateType ?? RATE_TYPES[0]}
            className={inputClass}
          >
            {RATE_TYPES.map((value) => (
              <option key={value} value={value}>
                {RATE_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Rate (QAR)" htmlFor="rateAmount">
          <input
            id="rateAmount"
            name="rateAmount"
            inputMode="decimal"
            defaultValue={toRiyalInput(defaultRateAmount)}
            className={inputClass}
          />
          {errors.rateAmount && (
            <p className="mt-1 text-xs text-red-600">{errors.rateAmount}</p>
          )}
        </Field>
      </div>

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
