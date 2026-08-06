/**
 * Currency is Qatari Riyal.
 *
 * Amounts are stored as integer HALALAS (1 riyal = 100 halalas), never riyals
 * and never floats. Rates and operator pay routinely carry a decimal — 137.50
 * per hour is normal — and rounding those to whole riyals is not acceptable,
 * so the smallest unit is the storage unit. Floats are never safe for money
 * and Prisma's Decimal loses precision on SQLite.
 *
 * Nothing outside this file should multiply or divide by 100.
 */

const HALALAS_PER_RIYAL = 100

/**
 * Decimals are shown only when the amount actually has halalas, so round
 * figures stay clean (QAR 5,000) while real rates keep their precision
 * (QAR 137.50). Nothing is ever rounded away.
 */
export function formatAmount(halalas: number | null | undefined): string {
  if (halalas === null || halalas === undefined) return '—'

  const hasFraction = halalas % HALALAS_PER_RIYAL !== 0

  return (halalas / HALALAS_PER_RIYAL).toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

export function formatQar(halalas: number | null | undefined): string {
  if (halalas === null || halalas === undefined) return '—'

  return `QAR ${formatAmount(halalas)}`
}

/** Always two decimals — for invoice columns that must line up. */
export function formatAmountExact(halalas: number | null | undefined): string {
  if (halalas === null || halalas === undefined) return '—'

  return (halalas / HALALAS_PER_RIYAL).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Parse a riyal amount typed by a user ("137.5", "1,200", "137.50") into
 * integer halalas. Returns null for blank, and undefined for unparseable
 * input so a caller can tell "not supplied" from "not a number".
 */
export function parseQar(
  value: FormDataEntryValue | null,
): number | null | undefined {
  if (value === null) return null

  const raw = String(value).trim().replace(/,/g, '')
  if (!raw) return null

  if (!/^\d*\.?\d*$/.test(raw)) return undefined

  const riyals = Number(raw)
  if (!Number.isFinite(riyals)) return undefined

  // Round to the nearest halala — binary floats cannot represent every two
  // decimal value exactly, so 1.15 * 100 must not be trusted unrounded.
  return Math.round(riyals * HALALAS_PER_RIYAL)
}
