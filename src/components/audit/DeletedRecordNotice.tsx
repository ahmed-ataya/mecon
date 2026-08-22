import Link from 'next/link'

/**
 * What a record detail page shows instead of a bare 404 when the id is
 * real but the record itself was deleted — the audit log still knows
 * about it (findDeletionRecord), so say that instead of pretending the
 * link was always broken.
 */
export function DeletedRecordNotice({
  entityTypeLabel,
  entityLabel,
}: {
  entityTypeLabel: string
  entityLabel: string | null
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-5 py-11 text-center">
      <p className="text-sm text-slate-500">
        This {entityTypeLabel.toLowerCase()}
        {entityLabel ? ` — "${entityLabel}"` : ''} was deleted. Its last known
        values are still in the audit log.
      </p>
      <Link
        href="/admin/audit"
        className="mt-3 inline-block text-sm font-medium text-slate-700 hover:underline"
      >
        View in audit log →
      </Link>
    </div>
  )
}
