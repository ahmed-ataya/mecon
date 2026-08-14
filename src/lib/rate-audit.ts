import {
  RATE_TYPE_DAYS,
  RATE_TYPE_HOURS,
  RATE_TYPE_LABELS,
  RATE_TYPE_PERIOD_LABELS,
  type RateType,
} from './enums'
import type { HoursSource } from './hours'
import type { Warning } from './warnings'

/**
 * Checks a quoted period against the duration actually used.
 *
 * ONE DIRECTION ONLY, and the asymmetry is the whole point:
 *
 *  - Quoted daily, used for a week or a month — never flagged. The customer
 *    pays the higher daily rate for longer, which is in our favour.
 *  - Quoted weekly, used for a day or two — flagged. A discounted weekly rate
 *    is being charged for what should have been billed daily.
 *  - Quoted monthly, used for less than a month — flagged, same reason.
 *
 * It reports and does not price. Working out what the shorter tier WOULD have
 * billed needs that tier's rate, and a contract carries one rate — the agreed
 * one. Inventing the comparison from an assumed uplift would put a number in
 * front of someone that the business never quoted, which is worse than no
 * number: it would get believed. So the flag states what was quoted and what
 * actually happened, and whoever reviews it decides against the quotation.
 *
 * A WARNING, NEVER A BLOCK. The business sometimes proceeds knowingly.
 */

export type RateTierAudit = {
  equipmentName: string
  rateType: RateType
  /** Working days the machine was actually on hire in this period. */
  billableDays: number
  /** Nominal working days in the quoted period — 26, 6 or 1. */
  quotedDays: number
  /** Nominal hours in the quoted period — 260, 60 or 10. */
  quotedHours: number
  /** Hours being billed, and whether they were measured or inferred. */
  hours: number
  hoursSource: HoursSource
}

export function auditRateTier({
  equipmentName,
  rateType,
  billableDays,
  hours,
  hoursSource,
}: {
  equipmentName: string
  rateType: string
  billableDays: number
  hours: number
  hoursSource: HoursSource
}): RateTierAudit | null {
  const quotedDays = RATE_TYPE_DAYS[rateType as RateType]

  // A period this code does not recognise cannot be judged against the hire —
  // and must not take invoice generation down with it. rateType is a string
  // column, so a value retired by a later change can still be read out of an
  // old row.
  if (quotedDays === undefined) return null

  // The favourable direction. Nothing to say.
  if (billableDays >= quotedDays) return null

  return {
    equipmentName,
    rateType: rateType as RateType,
    billableDays,
    quotedDays,
    quotedHours: RATE_TYPE_HOURS[rateType as RateType],
    hours,
    hoursSource,
  }
}

/** The audit as a sentence, for the warning list. */
export function describeRateTierAudit(audit: RateTierAudit): string {
  const quoted = RATE_TYPE_LABELS[audit.rateType].toLowerCase()
  const period = RATE_TYPE_PERIOD_LABELS[audit.rateType]
  const days = `${audit.billableDays} working day${audit.billableDays === 1 ? '' : 's'}`

  return (
    `${audit.equipmentName} is quoted on a ${quoted} rate — a full ${period} is ` +
    `${audit.quotedDays} working days — but was on hire ${days} in this period. ` +
    `A shorter-period rate would normally bill higher, so check the quotation ` +
    `before issuing.`
  )
}

export function rateTierWarning(audit: RateTierAudit): Warning {
  return {
    code: 'RATE_TIER_MISMATCH',
    severity: 'AMBER',
    message: describeRateTierAudit(audit),
  }
}
