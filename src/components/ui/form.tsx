import type { ReactNode } from 'react'

/**
 * Shared form building blocks. Centralising the class strings here keeps every
 * form in the system looking the same and makes a restyle a one-file change.
 */

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500'

export const buttonPrimaryClass =
  'inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50'

export const buttonSecondaryClass =
  'inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/** Red, because a validation failure blocks the save. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
      {message}
    </div>
  )
}

/**
 * Every error, listed at the top of the form.
 *
 * Inline messages only work for fields that are ON SCREEN. A field hidden
 * behind a conditional — operator cost when the arrangement is not a market
 * operator — has nowhere to show its error, so the submit fails and nothing
 * explains why. That happened, and it looked like the form was simply broken.
 *
 * `shown` lists the keys already rendered inline; anything else appears here so
 * no error can be invisible.
 */
export function ErrorSummary({
  errors,
  shown = [],
}: {
  errors: Record<string, string>
  shown?: string[]
}) {
  const hidden = Object.entries(errors).filter(
    ([field]) => field !== 'form' && !shown.includes(field),
  )

  if (hidden.length === 0) return null

  return (
    <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
      <p className="font-medium">This could not be saved</p>
      <ul className="mt-1 space-y-0.5">
        {hidden.map(([field, message]) => (
          <li key={field}>
            <span className="font-medium">{field}</span>: {message}
          </li>
        ))}
      </ul>
    </div>
  )
}
