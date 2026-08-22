'use client'

import { useActionState } from 'react'
import type { LoginActionState } from '@/lib/actions/auth'
import { login } from '@/lib/actions/auth'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  inputClass,
} from '@/components/ui/form'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginActionState, FormData>(
    login,
    {},
  )
  const errors = state.errors ?? {}

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm text-slate-500">Mecon Operations</p>

      <form action={formAction} className="space-y-4">
        <FormError message={errors.form} />

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={state.values?.email}
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
          />
        </Field>

        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
