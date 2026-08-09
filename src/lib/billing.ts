import { inclusiveDayCount, formatDate } from './dates'
import {
  RATE_TYPE_DAYS,
  RATE_TYPE_LABELS,
  RATE_TYPE_UOM,
  type RateType,
  type Uom,
} from './enums'
import { formatQar } from './money'
import type { Warning } from './warnings'

/**
 * Works out what a contract should be invoiced for over a period.
 *
 * The whole point is that it WALKS THE ASSIGNMENT HISTORY rather than assuming
 * one machine covered the period. If a machine broke down on the 7th and its
 * replacement started on the 8th, the period produces two lines with each
 * machine's actual days — which is what keeps billing continuous across a swap
 * and is why replacements close-and-open rather than overwrite.
 *
 * Nothing here writes to the database. It computes a proposal; the caller
 * decides whether to save it as a draft invoice.
 */

type Period = { start: Date; end: Date }

type OffHire = {
  startDate: Date
  endDate: Date | null
  reason: string
}

type EquipmentAssignmentLike = {
  id: string
  startDate: Date
  endDate: Date | null
  rateType: string
  rateAmount: number
  equipment: { name: string }
  offHirePeriods: OffHire[]
}

type OperatorAssignmentLike = {
  id: string
  startDate: Date
  endDate: Date | null
  arrangement: string
  operatorHourlyCost: number | null
  operatorHourlyRebill: number | null
  overtimeMultiplier: number
  normalHoursPerDay: number
  overtimeHoursPerDay: number
  operator: { name: string } | null
}

export type ProposedLine = {
  kind: string
  description: string
  uom: Uom
  quantity: number
  unitRate: number
  amount: number
  equipmentAssignmentId?: string
  operatorAssignmentId?: string
}

export type BillingProposal = {
  lines: ProposedLine[]
  total: number
  warnings: Warning[]
}

/** Days the two ranges share, inclusive at both ends. Zero if they miss. */
function overlapDays(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date,
): { days: number; from: Date; to: Date } | null {
  const from = aStart.getTime() > bStart.getTime() ? aStart : bStart
  // A null end means open-ended, so the period's end is the binding one.
  const aFinish = aEnd ?? bEnd
  const to = aFinish.getTime() < bEnd.getTime() ? aFinish : bEnd

  if (from.getTime() > to.getTime()) return null

  return { days: inclusiveDayCount(from, to), from, to }
}

/**
 * Days lost to off hire inside a window.
 *
 * Off-hire stretches are assumed not to overlap each other — they describe the
 * same machine standing idle, so two at once would be a data-entry error
 * rather than a case to handle.
 */
function offHireDaysWithin(
  offHires: OffHire[],
  from: Date,
  to: Date,
): { days: number; reasons: string[] } {
  let days = 0
  const reasons: string[] = []

  for (const offHire of offHires) {
    const overlap = overlapDays(offHire.startDate, offHire.endDate, from, to)
    if (!overlap) continue

    days += overlap.days
    reasons.push(offHire.reason)
  }

  return { days, reasons }
}

/**
 * Quantity in the rate's own units — 12 days on a monthly rate is 0.4 months.
 *
 * Prorating like this is the honest default, but it is exactly where money
 * goes missing: 0.4 of a monthly rate is usually less than 12 days at the
 * daily rate. That is what rateTierWarning exists to catch, and why the
 * manager can override the rate before issuing.
 */
function quantityInRateUnits(billableDays: number, rateType: RateType): number {
  const perUnit = RATE_TYPE_DAYS[rateType]

  // Two decimals is enough to read, and the amount is rounded to halalas
  // afterwards anyway.
  return Math.round((billableDays / perUnit) * 100) / 100
}

/**
 * Fires when a machine is billed on a rate covering MORE days than it actually
 * worked — a monthly rate for 12 days.
 *
 * Deliberately one-directional. A daily rate running for months is not flagged:
 * the customer simply pays more, which costs the business nothing. Only the
 * downward mismatch leaves money on the table.
 */
function rateTierWarning(
  equipmentName: string,
  rateType: RateType,
  billableDays: number,
  proratedAmount: number,
): Warning | null {
  const perUnit = RATE_TYPE_DAYS[rateType]

  if (billableDays >= perUnit) return null

  return {
    code: 'RATE_TIER_MISMATCH',
    severity: 'AMBER',
    message:
      `${equipmentName} is on a ${RATE_TYPE_LABELS[rateType].toLowerCase()} rate ` +
      `but worked only ${billableDays} day${billableDays === 1 ? '' : 's'}. ` +
      `Prorated that is ${formatQar(proratedAmount)} — check a shorter rate ` +
      `would not bill higher before issuing.`,
  }
}

type MobilizationLike = {
  mobilizationCharge: string | null
  mobilizationAmount: number | null
  demobilizationCharge: string | null
  demobilizationAmount: number | null
}

export function buildProposal({
  period: requestedPeriod,
  contract,
  equipmentAssignments,
  operatorAssignments,
  mobilization,
  includeMobilization = false,
  includeDemobilization = false,
}: {
  period: Period
  /**
   * The contract's own span. The period is clamped to it, because an
   * assignment left open does NOT mean the hire continued: a contract closing
   * on the 5th stops billing on the 5th even if nobody set an end date on the
   * machine. Without this a closed contract keeps billing every month and
   * overcharges the customer.
   */
  contract?: { mobilizationDate: Date; closingDate: Date | null }
  equipmentAssignments: EquipmentAssignmentLike[]
  operatorAssignments: OperatorAssignmentLike[]
  mobilization?: MobilizationLike
  /**
   * Mobilization normally lands on the FIRST invoice for a contract and
   * de-mobilization on the LAST. Short daily and weekly hires are the
   * exception — de-mob is often billed up front because everyone knows the
   * machine is coming back within the month. So both are opt-in per invoice
   * rather than inferred, and the caller decides the default.
   */
  includeMobilization?: boolean
  includeDemobilization?: boolean
}): BillingProposal {
  const lines: ProposedLine[] = []
  const warnings: Warning[] = []

  // Clamp to the contract. Nothing before mobilization, nothing after closing.
  const start =
    contract && contract.mobilizationDate.getTime() > requestedPeriod.start.getTime()
      ? contract.mobilizationDate
      : requestedPeriod.start

  const end =
    contract?.closingDate &&
    contract.closingDate.getTime() < requestedPeriod.end.getTime()
      ? contract.closingDate
      : requestedPeriod.end

  // The whole requested period falls outside the contract's life.
  if (start.getTime() > end.getTime()) {
    return { lines: [], total: 0, warnings: [] }
  }

  const period: Period = { start, end }

  // --- Equipment ----------------------------------------------------------

  for (const assignment of equipmentAssignments) {
    const overlap = overlapDays(
      assignment.startDate,
      assignment.endDate,
      period.start,
      period.end,
    )
    if (!overlap) continue

    const offHire = offHireDaysWithin(
      assignment.offHirePeriods,
      overlap.from,
      overlap.to,
    )
    const billableDays = Math.max(0, overlap.days - offHire.days)

    const rateType = assignment.rateType as RateType
    const quantity = quantityInRateUnits(billableDays, rateType)
    const amount = Math.round(quantity * assignment.rateAmount)

    lines.push({
      kind: 'EQUIPMENT',
      description:
        `${assignment.equipment.name} — ${formatDate(overlap.from)} to ${formatDate(overlap.to)}` +
        (offHire.days > 0
          ? ` (${billableDays} billable of ${overlap.days} days, ${offHire.days} off hire)`
          : ''),
      uom: RATE_TYPE_UOM[rateType],
      quantity,
      unitRate: assignment.rateAmount,
      amount,
      equipmentAssignmentId: assignment.id,
    })

    if (offHire.days > 0) {
      warnings.push({
        code: 'OFF_HIRE_DEDUCTED',
        severity: 'AMBER',
        message: `${assignment.equipment.name}: ${offHire.days} off-hire day${
          offHire.days === 1 ? '' : 's'
        } deducted from this period.`,
      })
    }

    if (billableDays > 0) {
      const tier = rateTierWarning(
        assignment.equipment.name,
        rateType,
        billableDays,
        amount,
      )
      if (tier) warnings.push(tier)
    }
  }

  // --- Operators ----------------------------------------------------------
  //
  // Operators are priced per hour, so days worked are converted using the
  // contract's own assumption — normally 8 normal hours plus about 2 overtime,
  // with overtime at the multiplier. Real timesheets will replace the
  // assumption later without changing this arithmetic.

  for (const assignment of operatorAssignments) {
    if (assignment.arrangement === 'WITHOUT_OPERATOR') continue
    if (assignment.operatorHourlyRebill === null) continue

    const overlap = overlapDays(
      assignment.startDate,
      assignment.endDate,
      period.start,
      period.end,
    )
    if (!overlap) continue

    // A machine standing off hire is not being operated, so the same days come
    // off the operator. Stated here because it is an assumption, not a fact.
    const machineOffHire = equipmentAssignments.flatMap(
      (equipment) => equipment.offHirePeriods,
    )
    const offHire = offHireDaysWithin(machineOffHire, overlap.from, overlap.to)
    const workedDays = Math.max(0, overlap.days - offHire.days)

    const rate = assignment.operatorHourlyRebill
    const normalHours = workedDays * assignment.normalHoursPerDay
    const overtimeHours = workedDays * assignment.overtimeHoursPerDay

    if (normalHours > 0) {
      lines.push({
        kind: 'OPERATOR_REBILL',
        description: `${assignment.operator?.name ?? 'Operator'} — ${workedDays} day${
          workedDays === 1 ? '' : 's'
        } at ${assignment.normalHoursPerDay} hrs`,
        uom: 'Hour',
        quantity: normalHours,
        unitRate: rate,
        amount: Math.round(normalHours * rate),
        operatorAssignmentId: assignment.id,
      })
    }

    if (overtimeHours > 0) {
      const overtimeRate = Math.round(rate * assignment.overtimeMultiplier)

      lines.push({
        kind: 'OPERATOR_REBILL',
        description: `${assignment.operator?.name ?? 'Operator'} — overtime at ${
          assignment.overtimeMultiplier
        }×`,
        uom: 'Hour',
        quantity: overtimeHours,
        unitRate: overtimeRate,
        amount: Math.round(overtimeHours * overtimeRate),
        operatorAssignmentId: assignment.id,
      })
    }
  }

  // --- Mobilization ------------------------------------------------------
  //
  // Always last on the invoice, matching how the printed form is filled in.

  if (includeMobilization && mobilization) {
    if (mobilization.mobilizationCharge === 'CHARGED') {
      const amount = mobilization.mobilizationAmount ?? 0

      lines.push({
        kind: 'MOBILIZATION',
        description: 'Mobilization',
        uom: 'Lump sum',
        quantity: 1,
        unitRate: amount,
        amount,
      })

      if (mobilization.mobilizationAmount === null) {
        warnings.push({
          code: 'MOBILIZATION_AMOUNT_MISSING',
          severity: 'AMBER',
          message:
            'Mobilization is charged but no amount is recorded — it will bill as zero. The figure comes from the quotation.',
        })
      }
    } else {
      warnings.push({
        code: 'MOBILIZATION_NOT_CHARGEABLE',
        severity: 'AMBER',
        message:
          'Mobilization was asked for but this contract mobilizes free of charge, so no line was added.',
      })
    }
  }

  if (includeDemobilization && mobilization) {
    if (mobilization.demobilizationCharge === 'CHARGED') {
      const amount = mobilization.demobilizationAmount ?? 0

      lines.push({
        kind: 'DEMOBILIZATION',
        description: 'De-mobilization',
        uom: 'Lump sum',
        quantity: 1,
        unitRate: amount,
        amount,
      })

      if (mobilization.demobilizationAmount === null) {
        warnings.push({
          code: 'DEMOBILIZATION_AMOUNT_MISSING',
          severity: 'AMBER',
          message:
            'De-mobilization is charged but no amount is recorded — it will bill as zero.',
        })
      }
    } else {
      warnings.push({
        code: 'DEMOBILIZATION_NOT_CHARGEABLE',
        severity: 'AMBER',
        message:
          'De-mobilization was asked for but this contract de-mobilizes free of charge, so no line was added.',
      })
    }
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0)

  return { lines, total, warnings }
}

/**
 * Splits a span into calendar-month periods.
 *
 * Most invoicing here is monthly — a customer hiring from 1 Aug to 15 Oct
 * usually wants an August, a September and an October invoice. Some want one
 * invoice for the whole span instead, which is simply not calling this.
 *
 * Months are clipped to the span, so the first and last are part months rather
 * than whole ones.
 */
export function splitIntoMonths(start: Date, end: Date): Period[] {
  const periods: Period[] = []
  let cursor = start

  while (cursor.getTime() <= end.getTime()) {
    const monthEnd = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
    )
    const periodEnd = monthEnd.getTime() < end.getTime() ? monthEnd : end

    periods.push({ start: cursor, end: periodEnd })

    cursor = new Date(
      Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate() + 1),
    )
  }

  return periods
}

/**
 * Invoicing dated after the LPO has expired.
 *
 * An open expiry can never be breached, so it is never checked. A closed one
 * is: raising an invoice against a lapsed LPO is how work ends up unpayable.
 */
export function lpoExpiryWarning(
  lpo: { number: string; validity: Date | null } | null,
  invoiceDate: Date,
): Warning | null {
  if (!lpo?.validity) return null
  if (invoiceDate.getTime() <= lpo.validity.getTime()) return null

  return {
    code: 'INVOICE_AFTER_LPO_EXPIRY',
    severity: 'RED',
    message: `This invoice is dated ${formatDate(invoiceDate)}, after LPO ${
      lpo.number
    } expired on ${formatDate(lpo.validity)}.`,
  }
}

/**
 * Consumption against an LPO.
 *
 * Totalled across EVERY contract under the LPO, not per contract. One LPO
 * commonly covers several machines and each machine is its own contract, so a
 * per-contract total would read a fraction of the truth and the ceiling would
 * be passed without anyone noticing.
 *
 * Drafts are excluded — nothing is consumed until an invoice is issued.
 */
export function lpoConsumption(
  lpo: { amount: number | null; number: string },
  invoices: { totalAmount: number; status: string }[],
): { invoiced: number; remaining: number | null; warning: Warning | null } {
  const invoiced = invoices
    .filter((invoice) => invoice.status !== 'DRAFT')
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0)

  // An open LPO has no ceiling, so there is nothing to consume against and a
  // warning would be meaningless.
  if (lpo.amount === null) {
    return { invoiced, remaining: null, warning: null }
  }

  const remaining = lpo.amount - invoiced
  const usedFraction = invoiced / lpo.amount

  if (remaining < 0) {
    return {
      invoiced,
      remaining,
      warning: {
        code: 'LPO_EXCEEDED',
        severity: 'RED',
        message: `LPO ${lpo.number} is exceeded by ${formatQar(-remaining)} — ${formatQar(
          invoiced,
        )} invoiced against ${formatQar(lpo.amount)}.`,
      },
    }
  }

  if (usedFraction >= 0.9) {
    return {
      invoiced,
      remaining,
      warning: {
        code: 'LPO_NEARLY_CONSUMED',
        severity: 'AMBER',
        message: `LPO ${lpo.number} is ${Math.round(
          usedFraction * 100,
        )}% consumed — ${formatQar(remaining)} remaining.`,
      },
    }
  }

  return { invoiced, remaining, warning: null }
}
