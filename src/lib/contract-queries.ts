import { db } from './db'
import { getContractStatus, type ContractStatus } from './contract-status'
import { getContractWarnings } from './contract-warnings'
import { assignmentsOverlap } from './contract-status'
import type { Warning } from './warnings'

/**
 * One include shape, used by both the master view and the detail page, so the
 * two can never disagree about what "currently assigned" means.
 */
export const contractInclude = {
  customer: { include: { documents: true } },
  equipmentAssignments: {
    include: {
      equipment: { include: { documents: { include: { approvedFor: true } } } },
    },
    orderBy: { startDate: 'asc' },
  },
  operatorAssignments: {
    include: { operator: { include: { documents: true } } },
    orderBy: { startDate: 'asc' },
  },
} as const

export type ContractWithRelations = Awaited<
  ReturnType<typeof loadContracts>
>[number]

/**
 * Loads contracts with their warnings resolved.
 *
 * Double-booking spans contracts, so it cannot be computed per contract in
 * isolation. Every equipment assignment is loaded once up front and the
 * clashes are matched in memory — otherwise this would be a query per machine
 * per contract.
 */
export async function loadContracts(where?: { id?: string }) {
  const contracts = await db.contract.findMany({
    where,
    include: contractInclude,
    orderBy: { mobilizationDate: 'desc' },
  })

  const allAssignments = await db.equipmentAssignment.findMany({
    include: { contract: { select: { id: true, projectName: true } } },
  })

  return contracts.map((contract) => {
    // Which other contracts use the same machine over an overlapping period.
    const clashesByEquipmentName: Record<string, { projectName: string }[]> = {}

    for (const assignment of contract.equipmentAssignments) {
      const clashes = allAssignments.filter(
        (other) =>
          other.equipmentId === assignment.equipmentId &&
          other.contractId !== contract.id &&
          assignmentsOverlap(assignment, other),
      )

      if (clashes.length > 0) {
        clashesByEquipmentName[assignment.equipment.name] = clashes.map(
          (clash) => ({ projectName: clash.contract.projectName }),
        )
      }
    }

    const warnings: Warning[] = getContractWarnings(
      contract,
      clashesByEquipmentName,
    )
    const status: ContractStatus = getContractStatus(contract)

    return { ...contract, warnings, status }
  })
}

export async function loadContract(id: string) {
  const [contract] = await loadContracts({ id })
  return contract ?? null
}
