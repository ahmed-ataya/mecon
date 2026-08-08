'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import type { Equipment } from '@prisma/client'
import {
  CAPACITY_UNITS,
  CAPACITY_UNIT_LABELS,
  EQUIPMENT_TYPES,
} from '@/lib/enums'
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
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  equipment?: Equipment
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const typeRef = useRef<HTMLSelectElement>(null)
  const unitRef = useRef<HTMLSelectElement>(null)

  // After a failed submit, fall back to what was typed rather than to the
  // stored record — otherwise React's post-action form reset discards it.
  const values = state.values
  const initial = {
    name: values?.name ?? equipment?.name ?? '',
    type: values?.type ?? equipment?.type ?? EQUIPMENT_TYPES[0],
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

  // Selects lose their value to React's post-action form reset — see NOTES.md.
  useEffect(() => {
    if (typeRef.current) typeRef.current.value = initial.type
    if (unitRef.current) unitRef.current.value = initial.capacityUnit
  })

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

        <Field label="Type" htmlFor="type">
          <select
            id="type"
            name="type"
            ref={typeRef}
            defaultValue={initial.type}
            className={inputClass}
          >
            {EQUIPMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
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
          <select
            id="capacityUnit"
            name="capacityUnit"
            ref={unitRef}
            defaultValue={initial.capacityUnit}
            className={inputClass}
          >
            {CAPACITY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {CAPACITY_UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
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
