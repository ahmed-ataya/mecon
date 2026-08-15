import Link from 'next/link'
import { db } from '@/lib/db'
import { rollUpStatus, summarizeStatuses } from '@/lib/document-status'
import { OPERATOR_SOURCE_LABELS, type OperatorSource } from '@/lib/enums'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SearchInput } from '@/components/ui/SearchInput'
import { buttonPrimaryClass } from '@/components/ui/form'

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const operators = await db.employee.findMany({
    where: {
      // Employee now holds every workforce category (Phase E0), but this
      // page is still specifically the operators list.
      category: 'OPERATOR',
      ...(query
        ? {
            OR: [
              // Postgres LIKE is case-sensitive — see customers/page.tsx
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
              { nationality: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { documents: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operators</h1>
          <p className="mt-1 text-sm text-slate-500">
            {operators.length} {operators.length === 1 ? 'operator' : 'operators'}
            {query && ' matching your search'}
          </p>
        </div>
        <Link href="/operators/new" className={buttonPrimaryClass}>
          Add operator
        </Link>
      </div>

      <SearchInput placeholder="Search by name, phone or nationality…" />

      {operators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {query
              ? `No operators match “${query}”.`
              : 'No operators yet. Add the first one to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Operator</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operators.map((operator) => {
                const status = rollUpStatus(operator.documents)
                const { expired, expiringSoon, total } = summarizeStatuses(
                  operator.documents,
                )

                return (
                  <tr key={operator.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/operators/${operator.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {operator.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {OPERATOR_SOURCE_LABELS[
                        operator.source as OperatorSource
                      ] ?? operator.source}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {operator.phone ?? '—'}
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
