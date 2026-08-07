import { db } from './db'
import { rollUpStatus, type DocumentStatus } from './document-status'
import { SITES, type Site } from './enums'
import { documentWarnings, siteApprovalWarning, type Warning } from './warnings'

/**
 * Options for the contract form's searchable dropdowns.
 *
 * Warnings are computed HERE, on the server, and sent down ready to display.
 * The alternative — shipping every document to the browser so the form can
 * work them out — would put document internals in the page source and give us
 * two copies of the expiry rules to keep in step.
 */

export type PartyOption = {
  value: string
  label: string
  sublabel?: string
  status: DocumentStatus
  warnings: Warning[]
}

export type EquipmentOption = PartyOption & {
  /**
   * Pre-resolved per site, because the site is chosen on the same form and the
   * check has to update the moment either side changes. Only five sites, so
   * this is cheaper than shipping the certificates themselves.
   */
  siteWarnings: Record<string, Warning | null>
}

export async function loadCustomerOptions(): Promise<PartyOption[]> {
  const customers = await db.customer.findMany({
    include: { documents: true },
    orderBy: { name: 'asc' },
  })

  return customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    sublabel: customer.contactPerson ?? undefined,
    status: rollUpStatus(customer.documents),
    warnings: documentWarnings(customer.name, customer.documents),
  }))
}

export async function loadEquipmentOptions(): Promise<EquipmentOption[]> {
  const equipment = await db.equipment.findMany({
    include: { documents: { include: { approvedFor: true } } },
    orderBy: { name: 'asc' },
  })

  return equipment.map((machine) => {
    const siteWarnings: Record<string, Warning | null> = {}

    for (const site of SITES) {
      siteWarnings[site] = siteApprovalWarning(
        machine.name,
        site as Site,
        machine.documents,
      )
    }

    return {
      value: machine.id,
      label: machine.name,
      sublabel: [machine.type, machine.plateNumber].filter(Boolean).join(' · '),
      status: rollUpStatus(machine.documents),
      warnings: documentWarnings(machine.name, machine.documents),
      siteWarnings,
    }
  })
}

export async function loadOperatorOptions(): Promise<PartyOption[]> {
  const operators = await db.operator.findMany({
    include: { documents: true },
    orderBy: { name: 'asc' },
  })

  return operators.map((operator) => ({
    value: operator.id,
    label: operator.name,
    sublabel: [operator.nationality, operator.phone].filter(Boolean).join(' · '),
    status: rollUpStatus(operator.documents),
    warnings: documentWarnings(operator.name, operator.documents),
  }))
}
