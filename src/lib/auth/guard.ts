import { redirect } from 'next/navigation'
import { getCurrentUser, type CurrentUser } from './session'
import {
  canDelete,
  canManageUsers,
  canViewAudit,
  canViewPayroll,
  canWrite,
} from '../permissions'

/**
 * Server-side enforcement for Server Actions. The UI hides buttons a role
 * can't use, but that's cosmetic on its own — a request can always be sent
 * directly, so every mutating action calls one of these first. Throws
 * rather than returning an error shape: reaching this point means either a
 * bug in the UI gating or someone bypassing it, neither of which is a normal
 * validation failure the existing inline-error pattern is meant for.
 */
export class PermissionError extends Error {}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new PermissionError('Sign in required.')
  return user
}

export async function requireWrite(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!canWrite(user.role)) {
    throw new PermissionError('Your role cannot make changes.')
  }
  return user
}

export async function requireDelete(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!canDelete(user.role)) {
    throw new PermissionError('Only Admin can delete records.')
  }
  return user
}

export async function requirePayrollAccess(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!canViewPayroll(user.role)) {
    throw new PermissionError('Payroll and salary data is visible to Admin only.')
  }
  return user
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser()
  if (!canManageUsers(user.role)) {
    throw new PermissionError('Admin only.')
  }
  return user
}

/**
 * Page-level guards — used at the top of a Server Component rather than a
 * Server Action, so they redirect instead of throwing: "not signed in" goes
 * to /login (proxy.ts should already have caught this; this is the second
 * check Next's own guidance recommends), "signed in but wrong role" goes
 * to / rather than an error page, since the nav already hides links a role
 * shouldn't see and reaching the URL directly isn't an error worth
 * alarming someone over.
 */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requirePayrollPage(): Promise<CurrentUser> {
  const user = await requirePageUser()
  if (!canViewPayroll(user.role)) redirect('/')
  return user
}

export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await requirePageUser()
  if (!canManageUsers(user.role)) redirect('/')
  return user
}

export async function requireAuditPage(): Promise<CurrentUser> {
  const user = await requirePageUser()
  if (!canViewAudit(user.role)) redirect('/')
  return user
}
