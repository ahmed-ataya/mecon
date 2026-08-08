import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { formatCapacity } from '@/lib/capacity'
import { rollUpStatus, summarizeStatuses } from '@/lib/document-status'
import {
  serializeDocument,
  sortDocumentsByUrgency,
} from '@/lib/serialize-document'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const equipment = await db.equipment.findUnique({
    where: { id },
    include: { documents: { include: { approvedFor: true } } },
  })

  if (!equipment) notFound()

  const status = rollUpStatus(equipment.documents)
  const { expired, expiringSoon } = summarizeStatuses(equipment.documents)
  const documents = sortDocumentsByUrgency(
    equipment.documents.map(serializeDocument),
  )

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/equipment"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Equipment
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {equipment.name}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[
                equipment.type,
                [equipment.brand, equipment.model].filter(Boolean).join(' '),
                formatCapacity(equipment.capacityValue, equipment.capacityUnit),
              ]
                .filter((part) => part && part !== '—')
                .join(' · ')}
            </p>
          </div>
          <Link
            href={`/equipment/${equipment.id}/edit`}
            className={buttonSecondaryClass}
          >
            Edit
          </Link>
        </div>
      </div>

      {(expired > 0 || expiringSoon > 0) && (
        <div
          className={`rounded-md px-4 py-3 text-sm ring-1 ring-inset ${
            expired > 0
              ? 'bg-red-50 text-red-700 ring-red-200'
              : 'bg-amber-50 text-amber-800 ring-amber-200'
          }`}
        >
          {expired > 0 && (
            <p>
              <strong>
                {expired} document{expired === 1 ? '' : 's'} expired.
              </strong>{' '}
              This machine should not be working on site until they are renewed.
            </p>
          )}
          {expiringSoon > 0 && (
            <p className={expired > 0 ? 'mt-1' : undefined}>
              {expiringSoon} document{expiringSoon === 1 ? '' : 's'} expiring
              within 30 days.
            </p>
          )}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Details</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Detail label="Type" value={equipment.type} />
          <Detail label="Brand" value={equipment.brand} />
          <Detail label="Model" value={equipment.model} />
          <Detail
            label="Capacity"
            value={formatCapacity(equipment.capacityValue, equipment.capacityUnit)}
          />
          <Detail
            label="Year of manufacture"
            value={
              equipment.yearOfManufacture
                ? String(equipment.yearOfManufacture)
                : null
            }
          />
          <Detail label="Registration number" value={equipment.plateNumber} />
          <Detail label="Serial number" value={equipment.serialNumber} />
          <Detail label="Notes" value={equipment.notes} />
        </dl>
      </section>

      <DocumentsSection
        ownerType="EQUIPMENT"
        ownerId={equipment.id}
        documents={documents}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value || '—'}</dd>
    </div>
  )
}
