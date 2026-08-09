import { daysUntil, formatDate } from './dates'
import type { Warning } from './warnings'

/**
 * Invoice status, with OVERDUE derived rather than stored.
 *
 * DRAFT / ISSUED / PAID are real lifecycle steps someone performs. OVERDUE is
 * not — it is simply "issued, past its due date, still unpaid", which becomes
 * true on its own as a day passes. Stored, it would be wrong every morning
 * until something touched the record; derived, it cannot go stale.
 */
export type InvoiceState = 'DRAFT' | 'ISSUED' | 'OVERDUE' | 'PAID'

type InvoiceLike = {
  status: string
  dueDate: Date | null
  paidDate: Date | null
}

export function getInvoiceState(invoice: InvoiceLike): InvoiceState {
  if (invoice.status === 'PAID') return 'PAID'
  if (invoice.status === 'DRAFT') return 'DRAFT'

  if (invoice.dueDate && daysUntil(invoice.dueDate) < 0) return 'OVERDUE'

  return 'ISSUED'
}

export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  OVERDUE: 'Overdue',
  PAID: 'Paid',
}

export const INVOICE_STATE_CLASSES: Record<InvoiceState, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
  ISSUED: 'bg-sky-50 text-sky-700 ring-sky-200',
  OVERDUE: 'bg-red-50 text-red-700 ring-red-200',
  PAID: 'bg-green-50 text-green-700 ring-green-200',
}

export function overdueWarning(
  invoice: InvoiceLike & { invoiceNumber: string },
): Warning | null {
  if (getInvoiceState(invoice) !== 'OVERDUE') return null

  const days = -daysUntil(invoice.dueDate!)

  return {
    code: 'INVOICE_OVERDUE',
    severity: 'RED',
    message: `Invoice ${invoice.invoiceNumber} is ${days} day${
      days === 1 ? '' : 's'
    } overdue — due ${formatDate(invoice.dueDate!)}.`,
  }
}
