/**
 * The total spelled out, as the printed invoices do it:
 *
 *   "Four Thousand Six Hundred Eighty Eight And 13/100 Only"
 *   "Nine Thousand Sixty Nine And 40/100 Only"
 *
 * Halalas are written as a fraction over 100 rather than as words, which is
 * how the existing invoices read, and the line always ends in "Only".
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
] as const

/** 0–999 in words. */
function underThousand(value: number): string {
  if (value === 0) return ''

  const parts: string[] = []
  const hundreds = Math.floor(value / 100)
  const rest = value % 100

  if (hundreds > 0) parts.push(`${ONES[hundreds]} Hundred`)

  if (rest > 0 && rest < 20) {
    parts.push(ONES[rest])
  } else if (rest >= 20) {
    const tens = Math.floor(rest / 10)
    const ones = rest % 10
    // "Sixty Nine", not "Sixty-Nine" — matching the printed invoices.
    parts.push(ones > 0 ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens])
  }

  return parts.join(' ')
}

const SCALES = [
  { value: 1_000_000_000, name: 'Billion' },
  { value: 1_000_000, name: 'Million' },
  { value: 1_000, name: 'Thousand' },
] as const

function wholeNumberInWords(value: number): string {
  if (value === 0) return 'Zero'

  const parts: string[] = []
  let remaining = value

  for (const scale of SCALES) {
    const count = Math.floor(remaining / scale.value)
    if (count > 0) {
      parts.push(`${wholeNumberInWords(count)} ${scale.name}`)
      remaining %= scale.value
    }
  }

  const tail = underThousand(remaining)
  if (tail) parts.push(tail)

  return parts.join(' ')
}

/**
 * Takes integer HALALAS, as everything money-related here does.
 *
 * 468813 -> "Four Thousand Six Hundred Eighty Eight And 13/100 Only"
 */
export function amountInWords(halalas: number): string {
  const negative = halalas < 0
  const absolute = Math.abs(Math.round(halalas))

  const riyals = Math.floor(absolute / 100)
  const fraction = absolute % 100

  const words = wholeNumberInWords(riyals)
  // Always two digits: 40/100, not 4/100.
  const fractionText = String(fraction).padStart(2, '0')

  return `${negative ? 'Minus ' : ''}${words} And ${fractionText}/100 Only`
}
