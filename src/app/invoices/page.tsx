import Link from 'next/link'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/dates'
import { formatQar } from '@/lib/money'
import {
  getInvoiceState,
  INVOICE_STATE_CLASSES,
  INVOICE_STATE_LABELS,
  type InvoiceState,
} from '@/lib/invoice-status'
import { SearchInput } from '@/components/ui/SearchInput'
import { buttonPrimaryClass } from '@/components/ui/form'
import { PageHeader } from '@/components/shell/PageHeader'

const FILTERS = [
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'draft', label: 'Drafts' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q, filter } = await searchParams
  const query = q?.trim().toLowerCase() ?? ''
  const active: FilterKey = FILTERS.some((f) => f.key === filter)
    ? (filter as FilterKey)
    : 'unpaid'

  const all = await db.invoice.findMany({
    include: {
      customer: true,
      lpo: true,
      contracts: { include: { contract: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const withState = all.map((invoice) => ({
    ...invoice,
    state: getInvoiceState(invoice),
  }))

  const counts = {
    unpaid: withState.filter((i) => i.state !== 'PAID' && i.state !== 'DRAFT')
      .length,
    draft: withState.filter((i) => i.state === 'DRAFT').length,
    overdue: withState.filter((i) => i.state === 'OVERDUE').length,
    paid: withState.filter((i) => i.state === 'PAID').length,
    all: withState.length,
  }

  const byFilter = withState.filter((invoice) => {
    if (active === 'unpaid')
      return invoice.state !== 'PAID' && invoice.state !== 'DRAFT'
    if (active === 'draft') return invoice.state === 'DRAFT'
    if (active === 'overdue') return invoice.state === 'OVERDUE'
    if (active === 'paid') return invoice.state === 'PAID'
    return true
  })

  const invoices = query
    ? byFilter.filter((invoice) =>
        [
          invoice.invoiceNumber,
          invoice.customer.name,
          invoice.lpo?.number ?? '',
          ...invoice.contracts.map((c) => c.contract.projectName),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : byFilter

  const outstanding = withState
    .filter((i) => i.state === 'ISSUED' || i.state === 'OVERDUE')
    .reduce((sum, i) => sum + i.totalAmount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={`${formatQar(outstanding)} outstanding across ${counts.unpaid} unpaid`}
        actions={
          <Link href="/invoices/new" className={buttonPrimaryClass}>
            Generate invoices
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const isActive = option.key === active
          return (
            <Link
              key={option.key}
              href={`/invoices?filter=${option.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                isActive
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {option.label}
              <span
                className={`ml-1.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}
              >
                {counts[option.key]}
              </span>
            </Link>
          )
        })}
      </div>

      <SearchInput placeholder="Search invoice no., customer, LPO or project…" />

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {all.length === 0
              ? 'No invoices yet. Generate the first from a contract.'
              : 'No invoices match this filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">No.</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">LPO</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    {invoice.contracts.length > 1 && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                        {invoice.contracts.length} contracts
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {invoice.customer.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(invoice.periodStart)} –{' '}
                    {formatDate(invoice.periodEnd)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {invoice.lpo?.number ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatQar(invoice.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                        INVOICE_STATE_CLASSES[invoice.state as InvoiceState]
                      }`}
                    >
                      {INVOICE_STATE_LABELS[invoice.state as InvoiceState]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
