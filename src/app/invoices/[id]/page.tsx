import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/dates'
import { formatAmountExact, formatQar } from '@/lib/money'
import { lpoConsumption, lpoExpiryWarning } from '@/lib/billing'
import { describeLpo } from '@/lib/lpo'
import {
  getInvoiceState,
  INVOICE_STATE_CLASSES,
  INVOICE_STATE_LABELS,
  overdueWarning,
} from '@/lib/invoice-status'
import type { Warning } from '@/lib/warnings'
import { WarningList } from '@/components/contracts/WarningList'
import { InvoiceActions } from '@/components/invoices/InvoiceActions'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lpo: { include: { invoices: true } },
      contracts: { include: { contract: true } },
      lineItems: {
        include: {
          equipmentAssignment: { include: { equipment: true } },
        },
      },
    },
  })

  if (!invoice) notFound()

  const state = getInvoiceState(invoice)
  const isDraft = state === 'DRAFT'

  // Delivery notes come from the assignments actually billed, so the printed
  // "D.N. NO." can never disagree with the machine on the line.
  const deliveryNotes = [
    ...new Set(
      invoice.lineItems
        .map((line) => line.equipmentAssignment?.deliveryNoteNumber)
        .filter((value): value is string => !!value),
    ),
  ]

  const warnings: Warning[] = []
  const overdue = overdueWarning(invoice)
  if (overdue) warnings.push(overdue)

  const expiry = lpoExpiryWarning(invoice.lpo, invoice.issuedDate ?? invoice.periodEnd)
  if (expiry) warnings.push(expiry)

  const consumption = invoice.lpo
    ? lpoConsumption(invoice.lpo, invoice.lpo.invoices)
    : null
  if (consumption?.warning) warnings.push(consumption.warning)

  if (invoice.contracts.length > 1) {
    warnings.push({
      code: 'COMBINED_INVOICE',
      severity: 'AMBER',
      message: `This invoice covers ${invoice.contracts.length} contracts. A dispute over one machine will hold up payment on all of them.`,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/invoices"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Invoices
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                Invoice {invoice.invoiceNumber}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${INVOICE_STATE_CLASSES[state]}`}
              >
                {INVOICE_STATE_LABELS[state]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <Link
                href={`/customers/${invoice.customerId}`}
                className="hover:underline"
              >
                {invoice.customer.name}
              </Link>
              {' · '}
              {formatDate(invoice.periodStart)} –{' '}
              {formatDate(invoice.periodEnd)}
            </p>
          </div>

          <Link
            href={`/invoices/${invoice.id}/print`}
            className={buttonSecondaryClass}
          >
            Print view
          </Link>
        </div>
      </div>

      <WarningList warnings={warnings} title="Check before issuing" />

      <InvoiceActions
        invoiceId={invoice.id}
        state={state}
        invoiceNumber={invoice.invoiceNumber}
        dueDate={invoice.dueDate}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Lines</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Particulars</th>
                <th className="py-2 pr-3 font-medium">UOM</th>
                <th className="py-2 pr-3 text-right font-medium">Qty</th>
                <th className="py-2 pr-3 text-right font-medium">Rate</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lineItems.map((line) => (
                <tr key={line.id}>
                  <td className="py-2 pr-3 text-slate-900">
                    {line.description}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{line.uom}</td>
                  <td className="py-2 pr-3 text-right text-slate-600">
                    {line.quantity}
                  </td>
                  <td className="py-2 pr-3 text-right text-slate-600">
                    {formatAmountExact(line.unitRate)}
                  </td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    {formatAmountExact(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300">
                <td colSpan={4} className="py-3 pr-3 text-right font-semibold">
                  TOTAL QAR
                </td>
                <td className="py-3 text-right font-semibold">
                  {formatAmountExact(invoice.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">References</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Detail
            label="Your order no. (LPO)"
            value={invoice.lpo?.number ?? '—'}
          />
          <Detail
            label="Your order date"
            value={
              invoice.lpo?.issuedDate ? formatDate(invoice.lpo.issuedDate) : '—'
            }
          />
          <Detail
            label="D.N. No."
            value={deliveryNotes.length > 0 ? deliveryNotes.join(', ') : '—'}
            hint={
              deliveryNotes.length === 0
                ? 'No delivery note recorded on the machine assignment'
                : undefined
            }
          />
          <Detail
            label="Contracts"
            value={invoice.contracts
              .map((row) => row.contract.projectName)
              .join(', ')}
          />
          <Detail
            label="Issued"
            value={invoice.issuedDate ? formatDate(invoice.issuedDate) : '—'}
          />
          <Detail
            label="Paid"
            value={invoice.paidDate ? formatDate(invoice.paidDate) : '—'}
          />
        </dl>
      </section>

      {invoice.lpo && consumption && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-2 font-semibold">
            LPO {invoice.lpo.number}
          </h2>
          <p className="text-sm text-slate-500">{describeLpo(invoice.lpo)}</p>

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <Detail
              label="Invoiced to date"
              value={formatQar(consumption.invoiced)}
              hint="Across every contract on this LPO. Drafts excluded."
            />
            <Detail
              label="Remaining"
              value={
                consumption.remaining === null
                  ? 'Open — no ceiling'
                  : formatQar(consumption.remaining)
              }
            />
            <Detail
              label="Contracts on this LPO"
              value={String(invoice.lpo.invoices.length)}
              hint="Invoices raised against it"
            />
          </dl>
        </section>
      )}

      {isDraft && (
        <p className="text-xs text-slate-500">
          This is a draft. It does not count against the LPO and its figures can
          still change. Issuing freezes it.
        </p>
      )}
    </div>
  )
}

function Detail({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
