import { hasAssignmentEnded } from './contract-status'
import type { Site } from './enums'
import { lpoValidityWarnings } from './lpo'
import {
  documentWarnings,
  doubleBookingWarning,
  siteApprovalWarning,
  type Warning,
} from './warnings'

/**
 * Assembles every warning for one contract.
 *
 * Assignments that have ENDED are skipped: a machine that came off the
 * contract in June should not still raise certificate warnings in August, and
 * that noise is what makes people stop reading warnings.
 *
 * Assignments that have not started yet ARE checked. An upcoming contract on a
 * QatarEnergy-family site is precisely when a certificate problem is still
 * fixable — waiting until the machine is on site defeats the point.
 */

type DocumentLike = {
  documentType: string
  documentNumber: string | null
  isApplicable: boolean
  expiryDate: Date | null
}

type CertificateLike = DocumentLike & { approvedFor: { body: string }[] }

export type ContractForWarnings = {
  siteName: string
  siteRegime: string
  lpo: { number: string; validity: Date | null } | null
  customer: { name: string; documents: DocumentLike[] }
  equipmentAssignments: {
    startDate: Date
    endDate: Date | null
    equipment: { name: string; documents: CertificateLike[] }
  }[]
  operatorAssignments: {
    startDate: Date
    endDate: Date | null
    operator: { name: string; documents: DocumentLike[] } | null
  }[]
}

/**
 * `clashesByEquipmentName` comes from a separate query (findDoubleBookings in
 * actions/contracts.ts) because it spans other contracts — it cannot be
 * derived from this contract alone.
 */
export function getContractWarnings(
  contract: ContractForWarnings,
  clashesByEquipmentName: Record<string, { projectName: string }[]> = {},
): Warning[] {
  const warnings: Warning[] = [
    ...documentWarnings(contract.customer.name, contract.customer.documents),
    ...lpoValidityWarnings(contract.lpo),
  ]

  for (const assignment of contract.equipmentAssignments) {
    if (hasAssignmentEnded(assignment)) continue

    const { equipment } = assignment

    warnings.push(...documentWarnings(equipment.name, equipment.documents))

    const siteWarning = siteApprovalWarning(
      equipment.name,
      contract.siteRegime as Site,
      equipment.documents,
      contract.siteName,
    )
    if (siteWarning) warnings.push(siteWarning)

    const clash = doubleBookingWarning(
      equipment.name,
      clashesByEquipmentName[equipment.name] ?? [],
    )
    if (clash) warnings.push(clash)
  }

  for (const assignment of contract.operatorAssignments) {
    if (hasAssignmentEnded(assignment)) continue
    if (!assignment.operator) continue

    warnings.push(
      ...documentWarnings(assignment.operator.name, assignment.operator.documents),
    )
  }

  return warnings
}

/** Running or scheduled — what the master view card shows. */
export function liveAssignments<T extends { startDate: Date; endDate: Date | null }>(
  assignments: T[],
): T[] {
  return assignments.filter((assignment) => !hasAssignmentEnded(assignment))
}
