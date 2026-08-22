'use server'

import { redirect } from 'next/navigation'
import { db } from '../db'
import { verifyPassword } from '../auth/password'
import { createSession, destroySession } from '../auth/session'

export type LoginActionState = {
  errors?: Record<string, string>
  values?: { email: string }
}

export async function login(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const values = { email }

  if (!email || !password) {
    return { errors: { form: 'Enter your email and password.' }, values }
  }

  const user = await db.user.findUnique({ where: { email } })

  // Same message whether the email doesn't exist or the password is wrong —
  // telling them apart would let someone probe which emails have accounts.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { errors: { form: 'Incorrect email or password.' }, values }
  }

  await createSession(user.id)
  redirect('/')
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
