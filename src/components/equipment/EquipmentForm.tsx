'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { Equipment } from '@prisma/client'
import { CAPACITY_UNITS, CAPACITY_UNIT_LABELS } from '@/lib/enums'
import { Combobox } from '@/components/ui/Combobox'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/equipment'

/** Shared by the new and edit pages — the parent binds the right action. */
export function EquipmentForm({
  action,
  equipment,
  typeSuggestions,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  equipment?: Equipment
  /** Known types — suggestions only, anything can be typed. */
  typeSuggestions: { value: string; label: string }[]
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // After a failed submit, fall back to what was typed rather than to the
  // stored record — otherwise React's post-action form reset discards it.
  const values = state.values
  const initial = {
    name: values?.name ?? equipment?.name ?? '',
    type: values?.type ?? equipment?.type ?? '',
    brand: values?.brand ?? equipment?.brand ?? '',
    model: values?.model ?? equipment?.model ?? '',
    yearOfManufacture:
      values?.yearOfManufacture ??
      (equipment?.yearOfManufacture ? String(equipment.yearOfManufacture) : ''),
    capacityValue:
      values?.capacityValue ??
      (equipment?.capacityValue !== null && equipment?.capacityValue !== undefined
        ? String(equipment.capacityValue)
        : ''),
    capacityUnit: values?.capacityUnit ?? equipment?.capacityUnit ?? 'TON',
    serialNumber: values?.serialNumber ?? equipment?.serialNumber ?? '',
    plateNumber: values?.plateNumber ?? equipment?.plateNumber ?? '',
    notes: values?.notes ?? equipment?.notes ?? '',
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={errors.form} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Unit label"
          htmlFor="name"
          hint="How the yard refers to it, e.g. CAT 320 #4"
        >
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

        <Field
          label="Type"
          htmlFor="type"
          hint="Type anything — suggestions come from machines already recorded."
        >
          <Combobox
            name="type"
            options={typeSuggestions}
            defaultValue={initial.type}
            placeholder="e.g. Boom Truck, Telehandler"
            allowCustom
          />
          {errors.type && (
            <p className="mt-1 text-xs text-red-600">{errors.type}</p>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Brand" htmlFor="brand" hint="e.g. JCB, Caterpillar">
          <input
            id="brand"
            name="brand"
            defaultValue={initial.brand}
            className={inputClass}
          />
        </Field>

        <Field label="Model" htmlFor="model" hint="e.g. 3DX PLUS, ZX190X-5A">
          <input
            id="model"
            name="model"
            defaultValue={initial.model}
            className={inputClass}
          />
        </Field>

        <Field label="Year of manufacture" htmlFor="yearOfManufacture">
          <input
            id="yearOfManufacture"
            name="yearOfManufacture"
            inputMode="numeric"
            placeholder="2022"
            defaultValue={initial.yearOfManufacture}
            className={inputClass}
          />
          {errors.yearOfManufacture && (
            <p className="mt-1 text-xs text-red-600">
              {errors.yearOfManufacture}
            </p>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Capacity"
          htmlFor="capacityValue"
          hint="The number only — 8.5 for an 8.5 ton boom truck."
        >
          <input
            id="capacityValue"
            name="capacityValue"
            inputMode="decimal"
            placeholder="8.5"
            defaultValue={initial.capacityValue}
            className={inputClass}
          />
          {errors.capacityValue && (
            <p className="mt-1 text-xs text-red-600">{errors.capacityValue}</p>
          )}
        </Field>

        <Field
          label="Capacity unit"
          htmlFor="capacityUnit"
          hint="Metres for a telehandler, where reach is the headline figure."
        >
          <Select
            name="capacityUnit"
            options={CAPACITY_UNITS.map((unit) => ({
              value: unit,
              label: CAPACITY_UNIT_LABELS[unit],
            }))}
            defaultValue={initial.capacityUnit}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Serial number" htmlFor="serialNumber">
          <input
            id="serialNumber"
            name="serialNumber"
            defaultValue={initial.serialNumber}
            className={inputClass}
          />
        </Field>

        <Field
          label="Registration number"
          htmlFor="plateNumber"
          hint="“Reg. No.” on the master sheet."
        >
          <input
            id="plateNumber"
            name="plateNumber"
            defaultValue={initial.plateNumber}
            className={inputClass}
          />
        </Field>
      </div>

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
