'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type { Employee } from '@prisma/client'
import {
  EMPLOYEE_CATEGORIES,
  EMPLOYEE_CATEGORY_LABELS,
  OPERATOR_SOURCES,
  OPERATOR_SOURCE_LABELS,
  type EmployeeCategory,
} from '@/lib/enums'
import { toRiyalInput } from '@/lib/money'
import { checkMinimumWage } from '@/lib/payroll'
import { Select } from '@/components/ui/Select'
import { MultiCombobox } from '@/components/ui/MultiCombobox'
import type { ComboboxOption } from '@/components/ui/Combobox'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/operators'

/** Shared by the new and edit pages — the parent binds the right action. */
export function OperatorForm({
  action,
  operator,
  equipmentTypeOptions,
  qualifiedTypes = [],
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  operator?: Employee
  /** Suggestions for "machines qualified to operate" — same source equipment
   * type entry already uses, so the vocabulary stays one list. */
  equipmentTypeOptions: ComboboxOption[]
  /** Equipment types this operator is already recorded as qualified for. */
  qualifiedTypes?: string[]
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // After a failed submit, fall back to what was typed rather than to the
  // stored record — otherwise React's post-action form reset discards it.
  const values = state.values
  const initial = {
    name: values?.name ?? operator?.name ?? '',
    employeeNumber: values?.employeeNumber ?? operator?.employeeNumber ?? '',
    jobTitle: values?.jobTitle ?? operator?.jobTitle ?? '',
    category:
      values?.category ?? operator?.category ?? EMPLOYEE_CATEGORIES[0],
    phone: values?.phone ?? operator?.phone ?? '',
    nationality: values?.nationality ?? operator?.nationality ?? '',
    source: values?.source ?? operator?.source ?? OPERATOR_SOURCES[0],
    notes: values?.notes ?? operator?.notes ?? '',
    qualifiedTypes: values?.qualifiedEquipmentTypes ?? qualifiedTypes,
    basicSalary: values?.basicSalary ?? toRiyalInput(operator?.basicSalary),
    housingAllowance:
      values?.housingAllowance ?? toRiyalInput(operator?.housingAllowance),
    transportAllowance:
      values?.transportAllowance ?? toRiyalInput(operator?.transportAllowance),
    foodAllowance: values?.foodAllowance ?? toRiyalInput(operator?.foodAllowance),
    siteAllowance: values?.siteAllowance ?? toRiyalInput(operator?.siteAllowance),
    otherAllowance:
      values?.otherAllowance ?? toRiyalInput(operator?.otherAllowance),
    housingProvidedInKind:
      values?.housingProvidedInKind ?? operator?.housingProvidedInKind ?? false,
    foodProvidedInKind:
      values?.foodProvidedInKind ?? operator?.foodProvidedInKind ?? false,
    bankName: values?.bankName ?? operator?.bankName ?? '',
    bankAccountNumber:
      values?.bankAccountNumber ?? operator?.bankAccountNumber ?? '',
  }

  // Live minimum-wage check as the payroll fields are typed — riyals here,
  // same as the inputs; checkMinimumWage itself works in halalas, but a
  // ×100 comparison is equivalent and avoids importing parseQar just for a
  // live warning.
  const [category, setCategory] = useState<EmployeeCategory>(
    initial.category as EmployeeCategory,
  )
  const [basicSalary, setBasicSalary] = useState(initial.basicSalary)
  const [housingAllowance, setHousingAllowance] = useState(initial.housingAllowance)
  const [foodAllowance, setFoodAllowance] = useState(initial.foodAllowance)
  const [housingInKind, setHousingInKind] = useState(initial.housingProvidedInKind)
  const [foodInKind, setFoodInKind] = useState(initial.foodProvidedInKind)

  const wageCheck = checkMinimumWage({
    basicSalary: basicSalary ? Math.round(Number(basicSalary) * 100) : null,
    housingAllowance: housingAllowance ? Math.round(Number(housingAllowance) * 100) : null,
    foodAllowance: foodAllowance ? Math.round(Number(foodAllowance) * 100) : null,
    housingProvidedInKind: housingInKind,
    foodProvidedInKind: foodInKind,
  })

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={errors.form} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <input
            id="name"
            name="name"
            defaultValue={initial.name}
            className={inputClass}
            autoFocus
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name}</p>
          )}
        </Field>

        <Field label="Category" htmlFor="category">
          <Select
            name="category"
            options={EMPLOYEE_CATEGORIES.map((value) => ({
              value,
              label: EMPLOYEE_CATEGORY_LABELS[value],
            }))}
            defaultValue={initial.category}
            onSelect={(value) => setCategory(value as EmployeeCategory)}
          />
          {errors.category && (
            <p className="mt-1 text-xs text-red-600">{errors.category}</p>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Employee number"
          htmlFor="employeeNumber"
          hint="The business's own staff number, not the system id."
        >
          <input
            id="employeeNumber"
            name="employeeNumber"
            defaultValue={initial.employeeNumber}
            className={inputClass}
          />
        </Field>

        <Field label="Job title" htmlFor="jobTitle">
          <input
            id="jobTitle"
            name="jobTitle"
            defaultValue={initial.jobTitle}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Source"
          htmlFor="source"
          hint="Market employees are subcontracted and re-billed to the customer."
        >
          <Select
            name="source"
            options={OPERATOR_SOURCES.map((source) => ({
              value: source,
              label: OPERATOR_SOURCE_LABELS[source],
            }))}
            defaultValue={initial.source}
          />
          {errors.source && (
            <p className="mt-1 text-xs text-red-600">{errors.source}</p>
          )}
        </Field>

        <Field label="Phone" htmlFor="phone">
          <input
            id="phone"
            name="phone"
            defaultValue={initial.phone}
            className={inputClass}
          />
        </Field>

        <Field label="Nationality" htmlFor="nationality">
          <input
            id="nationality"
            name="nationality"
            defaultValue={initial.nationality}
            className={inputClass}
          />
        </Field>
      </div>

      {category === 'OPERATOR' && (
        <Field
          label="Machines qualified to operate"
          htmlFor="qualifiedEquipmentTypes"
          hint="Not a closed list — type anything, or pick a suggestion."
        >
          <MultiCombobox
            name="qualifiedEquipmentTypes"
            options={equipmentTypeOptions}
            defaultValues={initial.qualifiedTypes}
            placeholder="e.g. Excavator, Boom Truck…"
          />
        </Field>
      )}

      <fieldset className="space-y-5 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">
          Payroll
        </legend>

        {!wageCheck.meetsMinimum && (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            <p className="font-medium">Below statutory minimum wage</p>
            <ul className="mt-1 list-disc pl-5">
              {wageCheck.shortfalls.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Basic salary (QAR/month)" htmlFor="basicSalary">
            <input
              id="basicSalary"
              name="basicSalary"
              inputMode="decimal"
              defaultValue={initial.basicSalary}
              onChange={(event) => setBasicSalary(event.target.value)}
              className={inputClass}
            />
            {errors.basicSalary && (
              <p className="mt-1 text-xs text-red-600">{errors.basicSalary}</p>
            )}
          </Field>

          <Field label="Transport allowance" htmlFor="transportAllowance">
            <input
              id="transportAllowance"
              name="transportAllowance"
              inputMode="decimal"
              defaultValue={initial.transportAllowance}
              className={inputClass}
            />
          </Field>

          <Field label="Site allowance" htmlFor="siteAllowance">
            <input
              id="siteAllowance"
              name="siteAllowance"
              inputMode="decimal"
              defaultValue={initial.siteAllowance}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Field label="Housing allowance" htmlFor="housingAllowance">
              <input
                id="housingAllowance"
                name="housingAllowance"
                inputMode="decimal"
                defaultValue={initial.housingAllowance}
                onChange={(event) => setHousingAllowance(event.target.value)}
                disabled={housingInKind}
                className={inputClass}
              />
            </Field>
            <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                name="housingProvidedInKind"
                defaultChecked={initial.housingProvidedInKind}
                onChange={(event) => setHousingInKind(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Provided in kind (accommodation given, not paid as allowance)
            </label>
          </div>

          <div>
            <Field label="Food allowance" htmlFor="foodAllowance">
              <input
                id="foodAllowance"
                name="foodAllowance"
                inputMode="decimal"
                defaultValue={initial.foodAllowance}
                onChange={(event) => setFoodAllowance(event.target.value)}
                disabled={foodInKind}
                className={inputClass}
              />
            </Field>
            <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                name="foodProvidedInKind"
                defaultChecked={initial.foodProvidedInKind}
                onChange={(event) => setFoodInKind(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Provided in kind (meals given, not paid as allowance)
            </label>
          </div>
        </div>

        <Field
          label="Other allowance"
          htmlFor="otherAllowance"
          hint="Anything not covered by the categories above."
        >
          <input
            id="otherAllowance"
            name="otherAllowance"
            inputMode="decimal"
            defaultValue={initial.otherAllowance}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Bank name" htmlFor="bankName">
            <input
              id="bankName"
              name="bankName"
              defaultValue={initial.bankName}
              className={inputClass}
            />
          </Field>

          <Field
            label="IBAN / wage card number"
            htmlFor="bankAccountNumber"
          >
            <input
              id="bankAccountNumber"
              name="bankAccountNumber"
              defaultValue={initial.bankAccountNumber}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial.notes}
          className={inputClass}
        />
      </Field>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href={cancelHref} className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
