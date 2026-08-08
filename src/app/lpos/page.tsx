import Link from 'next/link'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/dates'
import { formatQar } from '@/lib/money'
import {
  getLpoOpenness,
  LPO_OPENNESS_CLASSES,
  LPO_OPENNESS_LABELS,
} from '@/lib/lpo'
import { SearchInput } from '@/components/ui/SearchInput'
import { buttonPrimaryClass } from '@/components/ui/form'

export default async function LposPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const lpos = await db.lpo.findMany({
    where: query
      ? {
          OR: [
            { number: { contains: query, mode: 'insensitive' } },
            { customer: { name: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    include: { customer: true, _count: { select: { contracts: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LPOs</h1>
          <p className="mt-1 text-sm text-slate-500">
            {lpos.length} {lpos.length === 1 ? 'LPO' : 'LPOs'}
            {query && ' matching your search'}
          </p>
        </div>
        <Link href="/lpos/new" className={buttonPrimaryClass}>
          Add LPO
        </Link>
      </div>

      <SearchInput placeholder="Search by LPO number or customer…" />

      {lpos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {query
              ? `No LPOs match “${query}”.`
              : 'No LPOs yet. One LPO can cover several contracts.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">LPO</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Contracts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lpos.map((lpo) => {
                const openness = getLpoOpenness(lpo)

                return (
                  <tr key={lpo.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/lpos/${lpo.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {lpo.number}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${LPO_OPENNESS_CLASSES[openness]}`}
                        >
                          {LPO_OPENNESS_LABELS[openness]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lpo.customer.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lpo.amount === null ? (
                        <span className="text-slate-400">Open</span>
                      ) : (
                        formatQar(lpo.amount)
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lpo.validity === null ? (
                        <span className="text-slate-400">Open</span>
                      ) : (
                        formatDate(lpo.validity)
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lpo._count.contracts}
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
