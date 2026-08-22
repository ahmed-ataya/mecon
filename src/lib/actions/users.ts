'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { hashPassword } from '../auth/password'
import { requireAdmin } from '../auth/guard'
import { createdField, deletedField, diffField, type FieldChange, logAudit } from '../audit'
import { USER_ROLE_LABELS, type UserRole } from '../enums'
import { fieldErrors, userCreateSchema, userUpdateSchema } from '../validation'

export type ActionState = {
  errors?: Record<string, string>
  values?: { name: string; email: string; role: string }
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    role: String(formData.get('role') ?? ''),
  }
}

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin()

  const values = readForm(formData)
  const parsed = userCreateSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const clash = await db.user.findUnique({ where: { email: parsed.data.email } })
  if (clash) {
    return { errors: { email: 'A user with that email already exists.' }, values }
  }

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: hashPassword(parsed.data.password),
    },
  })

  await logAudit({
    user: admin,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    entityLabel: `${user.name} <${user.email}>`,
    // Never the password itself, hashed or not — see AuditLog's storage
    // discipline in schema.prisma.
    changedFields: [
      createdField('Name', user.name),
      createdField('Email', user.email),
      createdField('Role', user.role as UserRole, (r) => USER_ROLE_LABELS[r]),
    ],
  })

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function updateUser(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin()

  const values = readForm(formData)
  const parsed = userUpdateSchema.safeParse(values)

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const clash = await db.user.findUnique({ where: { email: parsed.data.email } })
  if (clash && clash.id !== id) {
    return { errors: { email: 'A user with that email already exists.' }, values }
  }

  // An Admin demoting themselves out of the only Admin account would lock
  // the whole system out of user management — block it rather than let it
  // happen silently.
  if (id === admin.id && parsed.data.role !== 'ADMIN') {
    const otherAdmins = await db.user.count({
      where: { role: 'ADMIN', id: { not: id } },
    })
    if (otherAdmins === 0) {
      return {
        errors: { role: 'You are the only Admin — promote someone else first.' },
        values,
      }
    }
  }

  const before = await db.user.findUnique({ where: { id } })

  const user = await db.user.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      ...(parsed.data.password ? { passwordHash: hashPassword(parsed.data.password) } : {}),
    },
  })

  const changedFields: FieldChange[] = [
    diffField('Name', before?.name, user.name),
    diffField('Email', before?.email, user.email),
    diffField(
      'Role',
      before?.role as UserRole | undefined,
      user.role as UserRole,
      (r) => USER_ROLE_LABELS[r],
    ),
  ].filter((c): c is FieldChange => c !== null)

  // A password reset is worth recording that it HAPPENED — never the value,
  // hashed or otherwise.
  if (parsed.data.password) {
    changedFields.push({ field: 'Password', was: null, now: 'Reset' })
  }

  await logAudit({
    user: admin,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    entityLabel: `${user.name} <${user.email}>`,
    changedFields,
  })

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function deleteUser(id: string) {
  const admin = await requireAdmin()

  if (id === admin.id) {
    throw new Error('You cannot delete your own account while signed in as it.')
  }

  const user = await db.user.delete({ where: { id } })

  await logAudit({
    user: admin,
    action: 'DELETE',
    entityType: 'User',
    entityId: user.id,
    entityLabel: `${user.name} <${user.email}>`,
    changedFields: [
      deletedField('Name', user.name),
      deletedField('Email', user.email),
      deletedField('Role', user.role as UserRole, (r) => USER_ROLE_LABELS[r]),
    ],
  })

  revalidatePath('/admin/users')
}
