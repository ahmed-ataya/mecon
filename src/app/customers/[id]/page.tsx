import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { rollUpStatus, summarizeStatuses } from '@/lib/document-status'
import { computeCompleteness } from '@/lib/document-completeness'
import {
  serializeDocument,
  sortDocumentsByUrgency,
} from '@/lib/serialize-document'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CompletenessCard } from '@/components/documents/CompletenessBar'
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { buttonSecondaryClass } from '@/components/ui/form'
import { requirePageUser } from '@/lib/auth/guard'
import { canDelete, canWrite } from '@/lib/permissions'
import { findDeletionRecord } from '@/lib/audit-queries'
import { DeletedRecordNotice } from '@/components/audit/DeletedRecordNotice'
import { RecordHistoryPanel } from '@/components/audit/RecordHistoryPanel'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const currentUser = await requirePageUser()
  const { id } = await params

  const customer = await db.customer.findUnique({
    where: { id },
    include: { documents: { include: { approvedFor: true } } },
  })

  if (!customer) {
    const deletion = await findDeletionRecord('Customer', id)
    if (deletion) {
      return (
        <DeletedRecordNotice entityTypeLabel="Customer" entityLabel={deletion.entityLabel} />
      )
    }
    notFound()
  }

  const status = rollUpStatus(customer.documents)
  const { expired, expiringSoon } = summarizeStatuses(customer.documents)
  const documents = sortDocumentsByUrgency(
    customer.documents.map(serializeDocument),
  )
  const completeness = computeCompleteness('CUSTOMER', customer.documents)

  return (
    <div className="space-y-6">
      <PageHeader
        crumb="Customers"
        crumbHref="/customers"
        title={customer.name}
        badge={<StatusBadge status={status} />}
        description={customer.contactPerson}
        actions={
          canWrite(currentUser.role) && (
            <Link
              href={`/customers/${customer.id}/edit`}
              className={buttonSecondaryClass}
            >
              Edit
            </Link>
          )
        }
      />

      {/* Legal documents must stay valid while a contract is open or an
          invoice is unpaid, so an expiry problem is surfaced up front. */}
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
              Valid legal documents are required while this customer has an open
              contract or an unpaid invoice.
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
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Contact person" value={customer.contactPerson} />
          <Detail label="Phone" value={customer.phone} />
          <Detail label="Email" value={customer.email} />
          <Detail label="Notes" value={customer.notes} />
        </dl>
      </section>

      <CompletenessCard completeness={completeness} />

      <DocumentsSection
        ownerType="CUSTOMER"
        ownerId={customer.id}
        documents={documents}
        canWrite={canWrite(currentUser.role)}
        canDelete={canDelete(currentUser.role)}
      />

      <RecordHistoryPanel entityType="Customer" entityId={customer.id} />
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
