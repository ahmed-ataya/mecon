/**
 * Minimal CSV generation — Excel opens this natively, so there's no reason
 * to pull in an .xlsx library for what's fundamentally tabular data. Same
 * "use what the platform gives you" choice the invoice print page already
 * made by using the browser's print dialog instead of a PDF library.
 */
function escapeCsvField(value: string | number): string {
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
}
