import { db } from './db'
import { hasAssignmentEnded } from './contract-status'

/**
 * Timesheet loading — list and detail, and the assignment pickers the
 * "new timesheet" forms need. Kept separate from contract-options.ts:
 * that module lists the current FLEET (every machine, every operator) for
 * the contract-creation form; this one lists ASSIGNMENTS (a specific
 * machine or operator's specific stint on a specific contract), which is
 * what a timesheet actually attaches to.
 */

const equipmentTimesheetInclude = {
  equipmentAssignment: {
    include: {
      equipment: true,
      contract: { include: { customer: true } },
    },
  },
  days: { orderBy: { date: 'asc' } },
} as const

const operatorTimesheetInclude = {
  operatorAssignment: {
    include: {
      operator: true,
      contract: { include: { customer: true } },
    },
  },
  days: { orderBy: { date: 'asc' } },
} as const

export async function loadEquipmentTimesheets() {
  return db.equipmentTimesheet.findMany({
    include: equipmentTimesheetInclude,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
}

export async function loadEquipmentTimesheet(id: string) {
  return db.equipmentTimesheet.findUnique({
    where: { id },
    include: equipmentTimesheetInclude,
  })
}

export async function loadOperatorTimesheets() {
  return db.operatorTimesheet.findMany({
    include: operatorTimesheetInclude,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
}

export async function loadOperatorTimesheet(id: string) {
  return db.operatorTimesheet.findUnique({
    where: { id },
    include: operatorTimesheetInclude,
  })
}

export type EquipmentAssignmentChoice = {
  id: string
  label: string
  startDate: Date
  endDate: Date | null
}

export type ContractChoiceWithEquipment = {
  id: string
  projectName: string
  siteName: string
  customerName: string
  assignments: EquipmentAssignmentChoice[]
}

/** Every contract with its equipment assignment history, for the "new
 * equipment timesheet" picker — current assignment first within each. */
export async function loadEquipmentAssignmentChoices(): Promise<
  ContractChoiceWithEquipment[]
> {
  const contracts = await db.contract.findMany({
    include: {
      customer: { select: { name: true } },
      equipmentAssignments: {
        include: { equipment: { select: { name: true } } },
        orderBy: { startDate: 'desc' },
      },
    },
    orderBy: { mobilizationDate: 'desc' },
  })

  return contracts
    .filter((contract) => contract.equipmentAssignments.length > 0)
    .map((contract) => ({
      id: contract.id,
      projectName: contract.projectName,
      siteName: contract.siteName,
      customerName: contract.customer.name,
      assignments: contract.equipmentAssignments
        .slice()
        .sort((a, b) => Number(hasAssignmentEnded(a)) - Number(hasAssignmentEnded(b)))
        .map((assignment) => ({
          id: assignment.id,
          label: assignment.equipment.name,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
        })),
    }))
}

export type OperatorAssignmentChoice = {
  id: string
  label: string
  startDate: Date
  endDate: Date | null
}

export type ContractChoiceWithOperator = {
  id: string
  projectName: string
  siteName: string
  customerName: string
  assignments: OperatorAssignmentChoice[]
}

/** Every contract with its operator assignment history — WITHOUT_OPERATOR
 * periods excluded, since there is nobody to record a timesheet for. */
export async function loadOperatorAssignmentChoices(): Promise<
  ContractChoiceWithOperator[]
> {
  const contracts = await db.contract.findMany({
    include: {
      customer: { select: { name: true } },
      operatorAssignments: {
        where: { operatorId: { not: null } },
        include: { operator: { select: { name: true } } },
        orderBy: { startDate: 'desc' },
      },
    },
    orderBy: { mobilizationDate: 'desc' },
  })

  return contracts
    .filter((contract) => contract.operatorAssignments.length > 0)
    .map((contract) => ({
      id: contract.id,
      projectName: contract.projectName,
      siteName: contract.siteName,
      customerName: contract.customer.name,
      assignments: contract.operatorAssignments
        .slice()
        .sort((a, b) => Number(hasAssignmentEnded(a)) - Number(hasAssignmentEnded(b)))
        .map((assignment) => ({
          id: assignment.id,
          label: assignment.operator!.name,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
        })),
    }))
}
