import { formatDate } from './dates'

/**
 * Whether mobilization is charged.
 *
 * The rule: a contract running a month or more mobilizes free of charge; under
 * a month it is charged.
 *
 * Derived from the dates rather than stored, so editing the closing date can
 * never leave a stale answer behind. `mobilizationCharge` is only written when
 * someone deliberately overrides the rule — a blank means "follow the rule",
 * which is the normal case and the one that must not go stale.
 */
export type MobilizationCharge = 'FREE' | 'CHARGED'

export const MOBILIZATION_CHARGES = ['FREE', 'CHARGED'] as const

export const MOBILIZATION_CHARGE_LABELS: Record<MobilizationCharge, string> = {
  FREE: 'Free of charge',
  CHARGED: 'Charged',
}

type ContractLike = {
  mobilizationDate: Date
  closingDate: Date | null
  mobilizationCharge: string | null
}

/**
 * A month means the same calendar day one month later — 15 Jan to 15 Feb is a
 * month, regardless of that month's length. Counting 30 days instead would
 * make February contracts charge and January ones not, for no business reason.
 */
export function isAtLeastOneMonth(start: Date, end: Date): boolean {
  const oneMonthOn = new Date(start)
  oneMonthOn.setUTCMonth(oneMonthOn.getUTCMonth() + 1)

  return end.getTime() >= oneMonthOn.getTime()
}

/** What the duration rule says, ignoring any override. */
export function chargeByRule(contract: {
  mobilizationDate: Date
  closingDate: Date | null
}): MobilizationCharge {
  // Ongoing means no agreed end, which is never a short hire.
  if (!contract.closingDate) return 'FREE'

  return isAtLeastOneMonth(contract.mobilizationDate, contract.closingDate)
    ? 'FREE'
    : 'CHARGED'
}

/** What actually applies: the override if one was set, otherwise the rule. */
export function effectiveCharge(contract: ContractLike): MobilizationCharge {
  if (
    contract.mobilizationCharge === 'FREE' ||
    contract.mobilizationCharge === 'CHARGED'
  ) {
    return contract.mobilizationCharge
  }

  return chargeByRule(contract)
}

export function isOverridden(contract: ContractLike): boolean {
  return effectiveCharge(contract) !== chargeByRule(contract)
}

/** Explains WHY, so nobody has to rediscover the rule from the code. */
export function explainCharge(contract: ContractLike): string {
  const rule = chargeByRule(contract)
  const actual = effectiveCharge(contract)

  const duration = !contract.closingDate
    ? 'Ongoing, so treated as a month or more'
    : isAtLeastOneMonth(contract.mobilizationDate, contract.closingDate)
      ? `Runs a month or more (to ${formatDate(contract.closingDate)})`
      : `Runs under a month (to ${formatDate(contract.closingDate)})`

  const ruleSays = MOBILIZATION_CHARGE_LABELS[rule].toLowerCase()

  if (actual === rule) return `${duration} — ${ruleSays} by the duration rule.`

  return `${duration}, so the rule says ${ruleSays} — overridden to ${MOBILIZATION_CHARGE_LABELS[
    actual
  ].toLowerCase()}.`
}
