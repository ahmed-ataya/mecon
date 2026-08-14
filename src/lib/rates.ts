import { RATE_TYPE_LABELS, type RateType } from './enums'
import { formatQar } from './money'

/**
 * How a rate reads wherever it is shown: "QAR 137.55/hour · Daily".
 *
 * Both halves matter and neither implies the other. The rate is always hourly
 * — it is what the invoice charges for each hour worked. The arrangement is
 * how the hire was agreed, which is a commercial term rather than a divisor,
 * so it is shown alongside rather than folded into the figure.
 *
 * Writing it as "QAR 137.55 per day" would be the old, wrong reading.
 */
export function describeRate(
  rateAmountHalalas: number,
  rateType: string,
): string {
  const arrangement = RATE_TYPE_LABELS[rateType as RateType] ?? rateType

  return `${formatQar(rateAmountHalalas)}/hour · ${arrangement}`
}
