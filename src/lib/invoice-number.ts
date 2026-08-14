/**
 * Invoice numbers raised BY THIS SYSTEM carry a leading 5, so they can be told
 * apart at a glance from the numbers written off the paper pad, which lead
 * with 1:
 *
 *   pad:     14235, 14236, 14237, …
 *   system:  54238, 54239, 54240, …
 *
 * The trailing four digits stay in step with the pad, so 54238 and 14238 are
 * recognisably the same position in one sequence — you can read either number
 * and know both where it sits and where it came from.
 *
 * Both kinds live in the same column and share one unique constraint, which is
 * what actually stops a clash. A pad number can still be typed onto a draft by
 * hand when an invoice has to match a pre-printed form.
 */

export const SYSTEM_INVOICE_PREFIX = '5'

/**
 * Where the system sequence begins. The pad had reached 14237, so the first
 * one this system raises is 54238 — the next position in the shared sequence.
 *
 * Change this ONLY to correct the starting point. Once invoices exist their
 * numbers are what drive the sequence forward, so raising it later would leave
 * a gap and lowering it would collide.
 */
export const FIRST_SYSTEM_SEQUENCE = 4238

/** Digits kept after the prefix. 4 keeps system and pad numbers the same width. */
const SEQUENCE_DIGITS = 4

const SYSTEM_NUMBER = /^5\d+$/

export function isSystemInvoiceNumber(value: string): boolean {
  return SYSTEM_NUMBER.test(value)
}

/**
 * The sequence position inside a system number, or null for anything else —
 * a pad number, or a hand-typed reference like "2026/A-12".
 *
 * Filtering these out is the point: without it, one pad number typed onto a
 * draft would drag the whole system sequence along with it.
 */
export function systemSequence(value: string): number | null {
  if (!isSystemInvoiceNumber(value)) return null

  const parsed = Number(value.slice(SYSTEM_INVOICE_PREFIX.length))
  return Number.isInteger(parsed) ? parsed : null
}

/**
 * 4238 -> "54238".
 *
 * Padding keeps the width stable while the sequence is four digits. Past 9999
 * it simply grows — the number stays unique and still starts with 5, which is
 * all that is being promised.
 */
export function formatSystemInvoiceNumber(sequence: number): string {
  return `${SYSTEM_INVOICE_PREFIX}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`
}

/** The next free position, given every number already used. */
export function nextSystemSequence(existing: string[]): number {
  const highest = existing.reduce((max, value) => {
    const sequence = systemSequence(value)
    return sequence !== null && sequence > max ? sequence : max
  }, FIRST_SYSTEM_SEQUENCE - 1)

  return highest + 1
}
