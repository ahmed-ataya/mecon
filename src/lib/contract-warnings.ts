import { isAssignmentActiveOn } from './contract-status'
import type { Site } from './enums'
import {
  documentWarnings,
  doubleBookingWarning,
  lpoWarnings,
  siteApprovalWarning,
  type Warning,
} from './warnings'

/**
 * Assembles every warning for one contract.
 *
 * Only CURRENT assignments are checked. A machine that came off the contract
 * in June should not still be raising certificate warnings in August — that is
 * noise, and noise is what makes people stop reading warnings.
 */

type DocumentLike = {
  documentType: string
  documentNumber: string | null
  isApplicable: boolean
  expiryDate: Date | null
}

type CertificateLike = DocumentLike & { approvedFor: { body: string }[] }

export type ContractForWarnings = {
  site: string
  lpoNumber: string | null
  lpoValidity: Date | null
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
    ...lpoWarnings(contract),
  ]

  for (const assignment of contract.equipmentAssignments) {
    if (!isAssignmentActiveOn(assignment)) continue

    const { equipment } = assignment

    warnings.push(...documentWarnings(equipment.name, equipment.documents))

    const siteWarning = siteApprovalWarning(
      equipment.name,
      contract.site as Site,
      equipment.documents,
    )
    if (siteWarning) warnings.push(siteWarning)

    const clash = doubleBookingWarning(
      equipment.name,
      clashesByEquipmentName[equipment.name] ?? [],
    )
    if (clash) warnings.push(clash)
  }

  for (const assignment of contract.operatorAssignments) {
    if (!isAssignmentActiveOn(assignment)) continue
    if (!assignment.operator) continue

    warnings.push(
      ...documentWarnings(assignment.operator.name, assignment.operator.documents),
    )
  }

  return warnings
}

/** Current equipment assignments — what the master view card shows. */
export function currentEquipment<T extends { startDate: Date; endDate: Date | null }>(
  assignments: T[],
): T[] {
  return assignments.filter((assignment) => isAssignmentActiveOn(assignment))
}
