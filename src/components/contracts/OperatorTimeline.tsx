'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { isAssignmentActiveOn } from '@/lib/contract-status'
import { formatDate, toDateInputValue } from '@/lib/dates'
import {
  ARRANGEMENTS,
  ARRANGEMENT_LABELS,
  ASSIGNMENT_REASON_LABELS,
  OPERATOR_ASSIGNMENT_REASONS,
  type Arrangement,
} from '@/lib/enums'
import { formatQar, toRiyalInput } from '@/lib/money'
import type { PartyOption } from '@/lib/contract-options'
import { replaceOperator } from '@/lib/actions/contracts'
import { Combobox } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'

export type OperatorAssignmentRow = {
  id: string
  startDate: Date
  endDate: Date | null
  reason: string
  note: string | null
  arrangement: string
  operatorCost: number | null
  operatorRebill: number | null
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
}: {
  assignments: OperatorAssignmentRow[]
  operatorOptions: PartyOption[]
}) {
  const [replacing, setReplacing] = useState<string | null>(null)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="font-semibold">Operators</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {assignments.length}{' '}
          {assignments.length === 1 ? 'assignment' : 'assignments'} on record
        </p>
      </div>

      <ol className="space-y-3">
        {assignments.map((assignment) => {
          const current = isAssignmentActiveOn(assignment)
          const margin =
            assignment.operatorRebill !== null && assignment.operatorCost !== null
              ? assignment.operatorRebill - assignment.operatorCost
              : null

          return (
            <li
              key={assignment.id}
              className={`rounded-md border p-4 ${
                current
                  ? 'border-slate-300 bg-white'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {assignment.operator?.name ?? 'Without operator'}
                    </span>
                    {current ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 ring-1 ring-inset ring-green-200">
                        Current
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
                        Ended
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

                  {(assignment.operatorCost !== null ||
                    assignment.operatorRebill !== null) && (
                    <p className="mt-1 text-xs text-slate-500">
                      Cost {formatQar(assignment.operatorCost)} · Rebill{' '}
                      {formatQar(assignment.operatorRebill)}
                      {margin !== null && (
                        <span
                          className={
                            margin < 0 ? 'text-red-600' : 'text-green-700'
                          }
                        >
                          {' · margin '}
                          {formatQar(margin)}
                        </span>
                      )}
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
                  <ReplaceOperatorForm
                    assignmentId={assignment.id}
                    operatorOptions={operatorOptions}
                    defaultArrangement={assignment.arrangement as Arrangement}
                    defaultCost={assignment.operatorCost}
                    defaultRebill={assignment.operatorRebill}
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

function ReplaceOperatorForm({
  assignmentId,
  operatorOptions,
  defaultArrangement,
  defaultCost,
  defaultRebill,
  minDate,
  onDone,
}: {
  assignmentId: string
  operatorOptions: PartyOption[]
  defaultArrangement: Arrangement
  defaultCost: number | null
  defaultRebill: number | null
  minDate: Date
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(
    replaceOperator.bind(null, assignmentId),
    {},
  )
  const errors = state.errors ?? {}

  const [arrangement, setArrangement] = useState<Arrangement>(
    defaultArrangement,
  )
  const [reason, setReason] = useState('SICK_INJURED')

  // Selects lose their value to React's post-action form reset — see NOTES.md.
  const arrangementRef = useRef<HTMLSelectElement>(null)
  const reasonRef = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    if (arrangementRef.current) arrangementRef.current.value = arrangement
    if (reasonRef.current) reasonRef.current.value = reason
  })

  const settled = useRef(state)
  useEffect(() => {
    if (settled.current !== state && !state.errors) onDone()
    settled.current = state
  }, [state, onDone])

  const needsOperator = arrangement !== 'WITHOUT_OPERATOR'
  const isMarket = arrangement === 'MARKET_OPERATOR'

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={errors.form} />

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Field label="Reason" htmlFor="reason">
          <select
            id="reason"
            name="reason"
            ref={reasonRef}
            defaultValue={reason}
            onChange={(event) => setReason(event.target.value)}
            className={inputClass}
          >
            {OPERATOR_ASSIGNMENT_REASONS.map((value) => (
              <option key={value} value={value}>
                {ASSIGNMENT_REASON_LABELS[value] ?? value}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {needsOperator && (
        <Field label="New operator" htmlFor="operatorId">
          <Combobox
            name="operatorId"
            options={operatorOptions}
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
        hint={`Must be after ${formatDate(minDate)}.`}
      >
        <input
          id="startDate"
          name="startDate"
          type="date"
          min={toDateInputValue(minDate)}
          className={inputClass}
        />
        {errors.startDate && (
          <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>
        )}
      </Field>

      {isMarket && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Operator cost (QAR)" htmlFor="operatorCost">
            <input
              id="operatorCost"
              name="operatorCost"
              inputMode="decimal"
              defaultValue={toRiyalInput(defaultCost)}
              className={inputClass}
            />
          </Field>

          <Field label="Operator rebill (QAR)" htmlFor="operatorRebill">
            <input
              id="operatorRebill"
              name="operatorRebill"
              inputMode="decimal"
              defaultValue={toRiyalInput(defaultRebill)}
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
          {pending ? 'Saving…' : 'Replace operator'}
        </button>
        <button type="button" onClick={onDone} className={buttonSecondaryClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
