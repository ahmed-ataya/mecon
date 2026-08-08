import Link from 'next/link'
import { db } from '@/lib/db'
import { formatCapacity } from '@/lib/capacity'
import { rollUpStatus, summarizeStatuses } from '@/lib/document-status'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SearchInput } from '@/components/ui/SearchInput'
import { buttonPrimaryClass } from '@/components/ui/form'

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const equipment = await db.equipment.findMany({
    where: query
      ? {
          OR: [
            // Postgres LIKE is case-sensitive — see customers/page.tsx
            { name: { contains: query, mode: 'insensitive' } },
            { type: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
            { model: { contains: query, mode: 'insensitive' } },
            { serialNumber: { contains: query, mode: 'insensitive' } },
            { plateNumber: { contains: query, mode: 'insensitive' } },
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
          <h1 className="text-2xl font-semibold tracking-tight">Equipment</h1>
          <p className="mt-1 text-sm text-slate-500">
            {equipment.length} {equipment.length === 1 ? 'machine' : 'machines'}
            {query && ' matching your search'}
          </p>
        </div>
        <Link href="/equipment/new" className={buttonPrimaryClass}>
          Add equipment
        </Link>
      </div>

      <SearchInput placeholder="Search by label, type, brand, model, serial or reg. no…" />

      {equipment.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {query
              ? `No machines match “${query}”.`
              : 'No equipment yet. Add the first machine to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Brand / model</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Y-O-M</th>
                <th className="px-4 py-3 font-medium">Reg. No.</th>
                <th className="px-4 py-3 font-medium">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipment.map((machine) => {
                const status = rollUpStatus(machine.documents)
                const { expired, expiringSoon, total } = summarizeStatuses(
                  machine.documents,
                )

                return (
                  <tr key={machine.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/equipment/${machine.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {machine.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{machine.type}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[machine.brand, machine.model]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatCapacity(machine.capacityValue, machine.capacityUnit)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {machine.yearOfManufacture ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {machine.plateNumber ?? '—'}
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
