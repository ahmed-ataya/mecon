'use client'

import { useActionState, useState } from 'react'
import { monthLabel, monthsInRange } from '@/lib/timesheet'
import type { CreateActionState } from '@/lib/actions/timesheets'
import { Combobox } from '@/components/ui/Combobox'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
} from '@/components/ui/form'

type AssignmentChoice = {
  id: string
  label: string
  startDate: Date
  endDate: Date | null
}

type ContractChoice = {
  id: string
  projectName: string
  siteName: string
  customerName: string
  assignments: AssignmentChoice[]
}

/**
 * Shared by both timesheet types — equipment and operator assignment
 * choices are the exact same shape (id, label, start, end), so one
 * component covers the cascading contract -> assignment -> month picker
 * for either. `assignmentNoun` is the only thing that changes the copy.
 */
export function NewTimesheetForm({
  action,
  contracts,
  assignmentNoun,
  cancelHref,
}: {
  action: (state: CreateActionState, formData: FormData) => Promise<CreateActionState>
  contracts: ContractChoice[]
  assignmentNoun: 'machine' | 'operator'
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  const [contractId, setContractId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')

  const selectedContract = contracts.find((c) => c.id === contractId)
  const selectedAssignment = selectedContract?.assignments.find(
    (a) => a.id === assignmentId,
  )

  const monthChoices = selectedAssignment
    ? monthsInRange(selectedAssignment.startDate, selectedAssignment.endDate)
    : []

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <FormError message={errors.form} />

      <Field label="Contract" htmlFor="contractId">
        <Combobox
          name="contractId"
          options={contracts.map((c) => ({
            value: c.id,
            label: c.projectName,
            sublabel: `${c.customerName} · ${c.siteName}`,
          }))}
          placeholder="Search contracts…"
          onSelect={(value) => {
            setContractId(value)
            const contract = contracts.find((c) => c.id === value)
            setAssignmentId(contract?.assignments[0]?.id ?? '')
          }}
        />
      </Field>

      {selectedContract && (
        <Field
          label={assignmentNoun === 'machine' ? 'Machine' : 'Operator'}
          htmlFor="assignmentId"
          hint={
            selectedContract.assignments.length > 1
              ? `This contract has had more than one ${assignmentNoun} — pick the one this timesheet is for.`
              : undefined
          }
        >
          <Select
            name="assignmentId"
            options={selectedContract.assignments.map((a) => ({
              value: a.id,
              label: a.label,
            }))}
            defaultValue={selectedAssignment?.id}
            onSelect={setAssignmentId}
          />
          {errors.assignmentId && (
            <p className="mt-1 text-xs text-red-600">{errors.assignmentId}</p>
          )}
        </Field>
      )}

      {selectedAssignment && (
        <Field label="Month" htmlFor="month">
          {monthChoices.length === 0 ? (
            <p className="text-sm text-slate-500">
              No calendar month falls within this assignment yet.
            </p>
          ) : (
            <MonthYearSelect choices={monthChoices} />
          )}
        </Field>
      )}

      {errors.year && <p className="text-xs text-red-600">{errors.year}</p>}
      {errors.month && <p className="text-xs text-red-600">{errors.month}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || !selectedAssignment}
          className={buttonPrimaryClass}
        >
          {pending ? 'Creating…' : 'Create timesheet'}
        </button>
        <a href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </a>
      </div>
    </form>
  )
}

/** year/month travel as one Select (options keyed "year-month") but submit
 * as two separate hidden-shaped fields, matching timesheetCreateSchema. */
function MonthYearSelect({
  choices,
}: {
  choices: { year: number; month: number }[]
}) {
  const [selected, setSelected] = useState(choices[0])

  return (
    <>
      <Select
        name="period"
        options={choices.map((c) => ({
          value: `${c.year}-${c.month}`,
          label: monthLabel(c.year, c.month),
        }))}
        defaultValue={`${choices[0].year}-${choices[0].month}`}
        onSelect={(value) => {
          const [year, month] = value.split('-').map(Number)
          setSelected({ year, month })
        }}
      />
      <input type="hidden" name="year" value={selected.year} />
      <input type="hidden" name="month" value={selected.month} />
    </>
  )
}
