/**
 * Employee status — ACTIVE | ON_LEAVE | EXITED — is NOT a stored field, same
 * "status is always derived" convention as contract status, document status
 * and invoice OVERDUE (see NOTES.md). It is derived from dateOfExit and
 * whether an APPROVED leave request currently covers today, so it can never
 * go stale relative to either.
 */

export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'EXITED'

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  EXITED: 'Exited',
}

export function deriveEmployeeStatus({
  dateOfExit,
  isOnApprovedLeaveToday,
  asOfDate,
}: {
  dateOfExit: Date | null
  isOnApprovedLeaveToday: boolean
  asOfDate: Date
}): EmployeeStatus {
  if (dateOfExit && dateOfExit <= asOfDate) return 'EXITED'
  if (isOnApprovedLeaveToday) return 'ON_LEAVE'
  return 'ACTIVE'
}
