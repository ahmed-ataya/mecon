import Link from 'next/link'
import { db } from '@/lib/db'
import { rollUpStatus, summarizeStatuses } from '@/lib/document-status'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SearchInput } from '@/components/ui/SearchInput'
import { buttonPrimaryClass } from '@/components/ui/form'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const customers = await db.customer.findMany({
    where: query
      ? {
          OR: [
            // mode: 'insensitive' is required on Postgres — its LIKE is
            // case-sensitive, unlike SQLite's. Without it "diar" stops
            // matching "Qatari Diar".
            { name: { contains: query, mode: 'insensitive' } },
            { contactPerson: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: { documents: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
            {query && ' matching your search'}
          </p>
        </div>
        <Link href="/customers/new" className={buttonPrimaryClass}>
          Add customer
        </Link>
      </div>

      <SearchInput placeholder="Search by name, contact, phone or email…" />

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {query
              ? `No customers match “${query}”.`
              : 'No customers yet. Add the first one to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => {
                const status = rollUpStatus(customer.documents)
                const { expired, expiringSoon, total } = summarizeStatuses(
                  customer.documents,
                )

                return (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {customer.contactPerson ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {customer.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status} />
                        <span className="text-xs text-slate-500">
                          {total === 0
                            ? 'none on file'
                            : [
                                expired > 0 && `${expired} expired`,
                                expiringSoon > 0 && `${expiringSoon} expiring`,
                              ]
                                .filter(Boolean)
                                .join(' · ') || `${total} on file`}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
