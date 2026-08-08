import { daysUntil, formatDate } from './dates'
import { EXPIRING_SOON_DAYS } from './document-status'
import { formatQar } from './money'
import type { Warning } from './warnings'

/**
 * An LPO is "open" when it carries no amount ceiling and/or no expiry.
 *
 * That is NOT a separate flag to tick — it is exactly the absence of those
 * values, so it is derived. Storing a type alongside them would let the two
 * disagree: an LPO marked "normal" with a blank amount, and no way to know
 * which was intended.
 *
 * Leaving a field blank is therefore a deliberate statement ("no ceiling was
 * agreed"), which is why the form says so rather than treating blank as
 * incomplete.
 */
export type LpoOpenness = 'NORMAL' | 'OPEN_AMOUNT' | 'OPEN_EXPIRY' | 'FULLY_OPEN'

type LpoLike = {
  amount: number | null
  validity: Date | null
}

export function getLpoOpenness(lpo: LpoLike): LpoOpenness {
  const openAmount = lpo.amount === null
  const openExpiry = lpo.validity === null

  if (openAmount && openExpiry) return 'FULLY_OPEN'
  if (openAmount) return 'OPEN_AMOUNT'
  if (openExpiry) return 'OPEN_EXPIRY'
  return 'NORMAL'
}

export const LPO_OPENNESS_LABELS: Record<LpoOpenness, string> = {
  NORMAL: 'Normal',
  OPEN_AMOUNT: 'Open amount',
  OPEN_EXPIRY: 'Open expiry',
  FULLY_OPEN: 'Open',
}

export const LPO_OPENNESS_CLASSES: Record<LpoOpenness, string> = {
  NORMAL: 'bg-slate-100 text-slate-600 ring-slate-200',
  OPEN_AMOUNT: 'bg-sky-50 text-sky-700 ring-sky-200',
  OPEN_EXPIRY: 'bg-sky-50 text-sky-700 ring-sky-200',
  FULLY_OPEN: 'bg-sky-50 text-sky-700 ring-sky-200',
}

/** "QAR 45,000 · valid to 15 Sep 2026", with open sides spelled out. */
export function describeLpo(lpo: LpoLike): string {
  const amount = lpo.amount === null ? 'Open amount' : formatQar(lpo.amount)
  const validity =
    lpo.validity === null ? 'open expiry' : `valid to ${formatDate(lpo.validity)}`

  return `${amount} · ${validity}`
}

/**
 * LPO validity warnings.
 *
 * An open expiry never warns — there is nothing to expire, and warning about
 * it would be noise. Consumption against the amount arrives in phase 3, and
 * must be totalled across EVERY contract under the LPO, not per contract.
 */
export function lpoValidityWarnings(
  lpo: { number: string; validity: Date | null } | null,
): Warning[] {
  if (!lpo?.validity) return []

  const days = daysUntil(lpo.validity)
  const reference = `LPO ${lpo.number}`

  if (days < 0) {
    return [
      {
        code: 'LPO_EXPIRED',
        severity: 'RED',
        message: `${reference} expired ${formatDate(lpo.validity)}.`,
      },
    ]
  }

  if (days <= EXPIRING_SOON_DAYS) {
    return [
      {
        code: 'LPO_EXPIRING_SOON',
        severity: 'AMBER',
        message: `${reference} expires in ${days} day${
          days === 1 ? '' : 's'
        } (${formatDate(lpo.validity)}).`,
      },
    ]
  }

  return []
}
