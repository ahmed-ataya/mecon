import { formatDate, workingDayCount } from './dates'
import {
  HOURS_PER_WORKING_DAY,
  RATE_TYPE_DAYS,
  RATE_TYPE_LABELS,
  type RateType,
  type Uom,
} from './enums'
import { effectiveCharge } from './mobilization'
import { formatQar } from './money'
import type { Warning } from './warnings'

/**
 * Works out what a contract should be invoiced for over a period.
 *
 * EVERYTHING IS BILLED IN HOURS, and the agreed rate is ALREADY hourly. A line
 * is hours times that rate, with nothing converted in between. Whether the
 * hire was arranged daily, weekly or monthly changes none of the arithmetic —
 * it is a term of the agreement, not a divisor. Pro rata therefore needs no
 * special case: a part period is simply fewer hours at the same rate.
 *
 * DAYS ARE WORKING DAYS, Saturday to Thursday. Those same rates are built on a
 * six-day week and a 26-day month, so counting Fridays here would put the day
 * count and the rate out of step with each other.
 *
 * ONE LINE PER MACHINE, covering machine and operator together, because the
 * customer is quoted a single rate for both: "Hire of Roller (3 Ton) with
 * Operator".
 *
 * It still WALKS THE ASSIGNMENT HISTORY. A machine replaced mid-period
 * produces one line per machine with its own dates, which is what keeps
 * billing continuous across a swap.
 *
 * Nothing here writes to the database. It proposes; the caller decides.
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
  equipment: {
    name: string
    type: string
    plateNumber: string | null
    capacityValue: number | null
    capacityUnit: string | null
  }
  offHirePeriods: OffHire[]
}

type OperatorAssignmentLike = {
  startDate: Date
  endDate: Date | null
  arrangement: string
}

export type ProposedLine = {
  kind: string
  description: string
  uom: Uom
  quantity: number
  unitRate: number
  amount: number
  equipmentAssignmentId?: string
  periodStart?: Date
  periodEnd?: Date
  hours?: number
  /** Days on hire in this span — the starting point for entering real hours. */
  billableDays?: number
}

export type BillingProposal = {
  lines: ProposedLine[]
  total: number
  warnings: Warning[]
}

/**
 * Days the two ranges share, inclusive at both ends. Null if they miss.
 *
 * `days` counts WORKING days — Saturday to Thursday — because that is what
 * every rate is built on. Fridays are not billable days, so a hire spanning
 * one is not a day longer for it.
 */
function overlapDays(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date,
): { days: number; from: Date; to: Date } | null {
  const from = aStart.getTime() > bStart.getTime() ? aStart : bStart
  const aFinish = aEnd ?? bEnd
  const to = aFinish.getTime() < bEnd.getTime() ? aFinish : bEnd

  if (from.getTime() > to.getTime()) return null

  return { days: workingDayCount(from, to), from, to }
}

/** Also working days, so the deduction is in the same unit as the hire. */
function offHireDaysWithin(offHires: OffHire[], from: Date, to: Date): number {
  let days = 0

  for (const offHire of offHires) {
    const overlap = overlapDays(offHire.startDate, offHire.endDate, from, to)
    if (overlap) days += overlap.days
  }

  return days
}

/** DD-MM-YYYY, the format used inside the line descriptions. */
export function shortDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${date.getUTCFullYear()}`
}

/**
 * The PARTICULARS text, matching how the invoices are written by hand:
 *
 *   "Hire of Wheel Excavator (20 Ton) with Operator"
 *   "Hire of Roller (3 Ton) with Operator"
 *   "Hire of Backhoe Loader (4 Ton) — Without Operator"
 */
export function describeHire(
  equipment: EquipmentAssignmentLike['equipment'],
  arrangement: string | null,
): string {
  const capacity =
    equipment.capacityValue !== null
      ? ` (${equipment.capacityValue} ${
          equipment.capacityUnit === 'METRE' ? 'M' : 'Ton'
        })`
      : ''

  const operator =
    arrangement === 'WITHOUT_OPERATOR' || arrangement === null
      ? ' — Without Operator'
      : ' with Operator'

  return `Hire of ${equipment.type}${capacity}${operator}`
}

/**
 * Fires when a hire arranged over a period ran for LESS than that period.
 *
 * The rate itself is hourly, so a short month bills fewer hours and the
 * arithmetic is never wrong. What is worth questioning is the agreement: a
 * monthly rate is normally quoted against a month's use, and four days on a
 * monthly arrangement is either a discount nobody meant to give or a minimum
 * charge nobody has recorded.
 *
 * One-directional on purpose. A daily arrangement running for months is never
 * flagged — the customer simply pays for every hour, which costs nothing.
 */
function rateTierWarning(
  equipmentName: string,
  rateType: RateType,
  billableDays: number,
): Warning | null {
  const perUnit = RATE_TYPE_DAYS[rateType]

  // An arrangement this code does not recognise cannot be judged against the
  // hire — and must not take invoice generation down with it. rateType is a
  // string column, so a value retired by a later change can still be read back
  // out of an old row.
  if (perUnit === undefined || billableDays >= perUnit) return null

  const arrangement = (RATE_TYPE_LABELS[rateType] ?? rateType).toLowerCase()

  return {
    code: 'RATE_TIER_MISMATCH',
    severity: 'AMBER',
    message:
      `${equipmentName} is on a ${arrangement} hire ` +
      `but was on site only ${billableDays} working day${billableDays === 1 ? '' : 's'} ` +
      `in this period. Check what was agreed for a part period.`,
  }
}

/**
 * The dates are here because whether mobilization is charged is DERIVED from
 * the contract's duration — a blank charge field means "follow the rule", not
 * "free". Reading the stored value alone would silently drop the charge on
 * every contract nobody had explicitly overridden, which is most of them.
 */
type MobilizationLike = {
  mobilizationDate: Date
  closingDate: Date | null
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
   * The contract's own span. The period is clamped to it: an assignment left
   * open does NOT mean the hire continued, and a contract closing on the 5th
   * stops billing on the 5th.
   */
  contract?: { mobilizationDate: Date; closingDate: Date | null }
  equipmentAssignments: EquipmentAssignmentLike[]
  operatorAssignments: OperatorAssignmentLike[]
  mobilization?: MobilizationLike
  includeMobilization?: boolean
  includeDemobilization?: boolean
}): BillingProposal {
  const lines: ProposedLine[] = []
  const warnings: Warning[] = []

  const start =
    contract && contract.mobilizationDate.getTime() > requestedPeriod.start.getTime()
      ? contract.mobilizationDate
      : requestedPeriod.start

  const end =
    contract?.closingDate &&
    contract.closingDate.getTime() < requestedPeriod.end.getTime()
      ? contract.closingDate
      : requestedPeriod.end

  if (start.getTime() > end.getTime()) {
    return { lines: [], total: 0, warnings: [] }
  }

  const period: Period = { start, end }

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
    const billableDays = Math.max(0, overlap.days - offHire)

    // Which operator arrangement was running over this span decides whether
    // the line reads "with Operator" or "Without Operator".
    const arrangement =
      operatorAssignments.find((operator) =>
        overlapDays(operator.startDate, operator.endDate, overlap.from, overlap.to),
      )?.arrangement ?? null

    const rateType = assignment.rateType as RateType
    // Straight through: the stored rate is the hourly rate the customer agreed.
    const rate = assignment.rateAmount

    // A STARTING POINT only. Real hours come from the timesheet and are
    // entered on the draft — the calendar cannot know them, which is why a
    // 23-day hire invoiced as 162.5 hours rather than 230.
    //
    // It is at least the right order of magnitude now: a full July is 26
    // working days, so 260 hours against the 255 actually invoiced. Counting
    // Fridays would have suggested 310.
    const suggestedHours = billableDays * HOURS_PER_WORKING_DAY

    lines.push({
      kind: 'EQUIPMENT',
      description: describeHire(assignment.equipment, arrangement),
      uom: 'Hours',
      quantity: suggestedHours,
      unitRate: rate,
      amount: Math.round(suggestedHours * rate),
      equipmentAssignmentId: assignment.id,
      periodStart: overlap.from,
      periodEnd: overlap.to,
      hours: suggestedHours,
      billableDays,
    })

    if (offHire > 0) {
      warnings.push({
        code: 'OFF_HIRE_DEDUCTED',
        severity: 'AMBER',
        message: `${assignment.equipment.name}: ${offHire} off-hire working day${
          offHire === 1 ? '' : 's'
        } excluded from the suggested hours.`,
      })
    }

    if (billableDays > 0) {
      const tier = rateTierWarning(assignment.equipment.name, rateType, billableDays)
      if (tier) warnings.push(tier)
    }
  }

  if (lines.length > 0) {
    warnings.push({
      code: 'HOURS_ARE_ESTIMATED',
      severity: 'AMBER',
      message:
        'Hours are a starting estimate — working days on hire (Sat–Thu) × 10. Replace them with the timesheet figures before issuing.',
    })
  }

  // --- Mobilization -------------------------------------------------------
  //
  // Charged together as a single lump sum when both apply, which is how the
  // invoices read: "Mobilization And Demobilization Charge ... LS 1 1,200.00".

  const chargeable = mobilization
    ? {
        mobilization: effectiveCharge(mobilization),
        // De-mobilization follows the same duration rule, with its own override.
        demobilization: effectiveCharge({
          mobilizationDate: mobilization.mobilizationDate,
          closingDate: mobilization.closingDate,
          mobilizationCharge: mobilization.demobilizationCharge,
        }),
      }
    : null

  const wantsMob = includeMobilization && chargeable?.mobilization === 'CHARGED'
  const wantsDemob =
    includeDemobilization && chargeable?.demobilization === 'CHARGED'

  if (wantsMob || wantsDemob) {
    const amount =
      (wantsMob ? (mobilization!.mobilizationAmount ?? 0) : 0) +
      (wantsDemob ? (mobilization!.demobilizationAmount ?? 0) : 0)

    const label =
      wantsMob && wantsDemob
        ? 'Mobilization And Demobilization Charge'
        : wantsMob
          ? 'Mobilization Charge'
          : 'Demobilization Charge'

    lines.push({
      kind: wantsMob ? 'MOBILIZATION' : 'DEMOBILIZATION',
      description: label,
      uom: 'LS',
      quantity: 1,
      unitRate: amount,
      amount,
    })

    if (amount === 0) {
      warnings.push({
        code: 'MOBILIZATION_AMOUNT_MISSING',
        severity: 'AMBER',
        message: `${label} has no amount recorded and will bill as zero. The figure comes from the quotation.`,
      })
    }
  }

  if (includeMobilization && chargeable?.mobilization !== 'CHARGED') {
    warnings.push({
      code: 'MOBILIZATION_NOT_CHARGEABLE',
      severity: 'AMBER',
      message:
        'Mobilization was asked for but this contract mobilizes free of charge, so no line was added.',
    })
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0)

  return { lines, total, warnings }
}

/**
 * Splits a span into calendar-month periods.
 *
 * Most invoicing here is monthly. A single invoice CAN still carry two spans
 * as separate lines — 16-30 June and 1-11 July on one invoice — which is what
 * NOT calling this produces.
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
      Date.UTC(
        periodEnd.getUTCFullYear(),
        periodEnd.getUTCMonth(),
        periodEnd.getUTCDate() + 1,
      ),
    )
  }

  return periods
}

/**
 * Consumption against an LPO, totalled across EVERY contract under it.
 * Drafts are excluded — nothing is consumed until an invoice is issued.
 */
export function lpoConsumption(
  lpo: { amount: number | null; number: string },
  invoices: { totalAmount: number; status: string }[],
): { invoiced: number; remaining: number | null; warning: Warning | null } {
  const invoiced = invoices
    .filter((invoice) => invoice.status !== 'DRAFT')
    .reduce((sum, invoice) => sum + invoice.totalAmount, 0)

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

/**
 * Invoicing dated after the LPO has expired. An open expiry can never be
 * breached, so it is never checked.
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
