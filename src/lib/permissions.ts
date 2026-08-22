import type { UserRole } from './enums'

/**
 * The single place a role becomes an actual yes/no for a given action.
 * Pure and side-effect free (no cookies, no database) so it's safe to import
 * from both Server and Client Components — pages use it to decide whether
 * to render an Edit/Delete button at all; src/lib/auth/guard.ts wraps these
 * with a real session lookup for the enforcement side (Server Actions must
 * never trust that the UI already hid the button — see its own comment).
 *
 * ADMIN — full access, including payroll/salary/gratuity/audit, manages
 * accounts.
 * OPERATIONS — create/edit everywhere except payroll/salary; no delete, no
 * user management.
 * VIEWER — read-only everywhere except payroll/salary, which stays hidden
 * the same as it is from OPERATIONS.
 */

export function canWrite(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'OPERATIONS'
}

export function canDelete(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canViewPayroll(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'ADMIN'
}

export function canViewAudit(role: UserRole): boolean {
  return role === 'ADMIN'
}
