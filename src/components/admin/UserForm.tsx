'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { User } from '@prisma/client'
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from '@/lib/enums'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/users'

export function UserForm({
  action,
  user,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  user?: User
  submitLabel: string
  cancelHref: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  const values = {
    name: state.values?.name ?? user?.name ?? '',
    email: state.values?.email ?? user?.email ?? '',
    role: (state.values?.role ?? user?.role ?? USER_ROLES[1]) as UserRole,
  }

  return (
    <form action={formAction} className="max-w-lg space-y-5">
      <FormError message={errors.form} />

      <Field label="Name" htmlFor="name">
        <input
          id="name"
          name="name"
          defaultValue={values.name}
          className={inputClass}
          autoFocus
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </Field>

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={values.email}
          className={inputClass}
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </Field>

      <Field
        label={user ? 'New password' : 'Password'}
        htmlFor="password"
        hint={user ? 'Leave blank to keep the current password.' : undefined}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600">{errors.password}</p>
        )}
      </Field>

      <Field label="Role" htmlFor="role">
        <Select
          name="role"
          options={USER_ROLES.map((value) => ({
            value,
            label: USER_ROLE_LABELS[value],
          }))}
          defaultValue={values.role}
        />
        {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role}</p>}
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
