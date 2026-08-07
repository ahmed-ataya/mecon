import { todayUtc } from './dates'

/**
 * Contract status, derived from dates every time it is read.
 *
 * Never stored — a stored status goes stale the moment a date passes without
 * anyone touching the record, which is exactly when it matters most.
 *
 * "Needs attention" is deliberately NOT one of these. It cuts across all three
 * (an upcoming contract can need attention just as much as an active one), so
 * it is a filter over warnings rather than a status. See warnings.ts.
 */
export type ContractStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED'

type ContractLike = {
  mobilizationDate: Date
  closingDate: Date | null
}

/**
 * closingDate is the LAST day of the contract, inclusive — a contract closing
 * on the 31st is still active on the 31st.
 */
export function getContractStatus(contract: ContractLike): ContractStatus {
  const today = todayUtc().getTime()

  if (contract.closingDate && contract.closingDate.getTime() < today) {
    return 'CLOSED'
  }

  if (contract.mobilizationDate.getTime() > today) return 'UPCOMING'

  return 'ACTIVE'
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  UPCOMING: 'Upcoming',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
}

export const CONTRACT_STATUS_CLASSES: Record<ContractStatus, string> = {
  UPCOMING: 'bg-sky-50 text-sky-700 ring-sky-200',
  ACTIVE: 'bg-green-50 text-green-700 ring-green-200',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-200',
}

type AssignmentLike = {
  startDate: Date
  endDate: Date | null
}

/**
 * Is this assignment running on `date`? Both ends are inclusive, and a null
 * endDate means still assigned.
 *
 * This is the single definition of "current" used by the master view, the
 * double-booking check and phase 3 billing — they must not drift apart.
 */
export function isAssignmentActiveOn(
  assignment: AssignmentLike,
  date: Date = todayUtc(),
): boolean {
  const at = date.getTime()

  if (assignment.startDate.getTime() > at) return false
  if (assignment.endDate && assignment.endDate.getTime() < at) return false

  return true
}

/** Do two assignment periods overlap at all? Used for the double-booking check. */
export function assignmentsOverlap(
  a: AssignmentLike,
  b: AssignmentLike,
): boolean {
  const aEnd = a.endDate?.getTime() ?? Infinity
  const bEnd = b.endDate?.getTime() ?? Infinity

  return a.startDate.getTime() <= bEnd && b.startDate.getTime() <= aEnd
}
