import { db } from './db'
import { describeLpo } from './lpo'
import { rollUpStatus, type DocumentStatus } from './document-status'
import { SITES, SITE_LABELS, type Site } from './enums'
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

export type LocationOption = {
  value: string
  label: string
  sublabel?: string
  /** The regime this location was last recorded under, used to autofill. */
  regime: string
}

/**
 * Locations already used, most recent first.
 *
 * There is no locations table — the list is derived from the contracts
 * themselves, so it grows as jobs are recorded and never needs maintaining.
 * The regime comes from the most recent contract at that location, which is
 * what the form autofills when a known location is picked.
 */
export async function loadLocationOptions(): Promise<LocationOption[]> {
  const contracts = await db.contract.findMany({
    select: { siteName: true, siteRegime: true, mobilizationDate: true },
    orderBy: { mobilizationDate: 'desc' },
  })

  const seen = new Map<string, LocationOption>()

  for (const contract of contracts) {
    const key = contract.siteName.trim().toLowerCase()
    if (!key || seen.has(key)) continue

    seen.set(key, {
      value: contract.siteName,
      label: contract.siteName,
      sublabel: SITE_LABELS[contract.siteRegime as Site] ?? contract.siteRegime,
      regime: contract.siteRegime,
    })
  }

  return [...seen.values()]
}

export type LpoOption = {
  value: string
  label: string
  sublabel?: string
  customerId: string
}

/**
 * LPOs available to put a contract on.
 *
 * The sublabel spells out amount and expiry, including when either is open, so
 * the commercial basis is visible at the point of choosing rather than one
 * click away.
 */
export async function loadLpoOptions(): Promise<LpoOption[]> {
  const lpos = await db.lpo.findMany({
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return lpos.map((lpo) => ({
    value: lpo.id,
    label: lpo.number,
    sublabel: `${lpo.customer.name} · ${describeLpo(lpo)}`,
    customerId: lpo.customerId,
  }))
}

/** Everyone who has performed a mobilization before — grows with use. */
export async function loadMobilizedByOptions(): Promise<
  { value: string; label: string }[]
> {
  const rows = await db.contract.findMany({
    where: { mobilizationBy: { not: null } },
    select: { mobilizationBy: true },
    distinct: ['mobilizationBy'],
    orderBy: { mobilizationBy: 'asc' },
  })

  return rows
    .map((row) => row.mobilizationBy!)
    .filter((name) => name.trim() !== '')
    .map((name) => ({ value: name, label: name }))
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
