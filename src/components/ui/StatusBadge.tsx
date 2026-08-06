import {
  DOCUMENT_STATUS_CLASSES,
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from '@/lib/document-status'

/** The one place a document status turns into colour. Used in lists, detail
 *  pages, and (from phase 2) inline in the searchable dropdowns. */
export function StatusBadge({
  status,
  label,
}: {
  status: DocumentStatus
  label?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${DOCUMENT_STATUS_CLASSES[status]}`}
    >
      {label ?? DOCUMENT_STATUS_LABELS[status]}
    </span>
  )
}
