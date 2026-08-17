'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  APPROVAL_BODY_LABELS,
  THIRD_PARTY_CERTIFICATE,
  type OwnerType,
} from '@/lib/enums'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { buttonSecondaryClass } from '@/components/ui/form'
import {
  createDocument,
  deleteDocument,
  updateDocument,
} from '@/lib/actions/documents'
import { DocumentForm } from './DocumentForm'
import type { DocumentWithApprovals } from './types'

/**
 * PDF and images render natively in a browser tab, so "View" is honest — the
 * browser shows the file, it doesn't just save it. Anything else (were the
 * allowed-type list ever widened beyond Phase C's PDF/image restriction)
 * wouldn't render inline, so it gets the more accurate "Download".
 */
function fileActionLabel(fileType: string | null) {
  if (fileType === 'application/pdf' || fileType?.startsWith('image/')) {
    return 'View'
  }
  return 'Download'
}

/**
 * "Other" alone is what every Other document used to be labelled — this is
 * the whole point of F1: show what it actually is, falling back to the bare
 * type on old-shaped data that predates the field.
 */
function documentHeading(document: DocumentWithApprovals) {
  if (document.documentType === 'Other' && document.otherLabel) {
    return `Other — ${document.otherLabel}`
  }
  return document.documentType
}

/**
 * Documents panel shared by Customers, Equipment and Operators — the owner
 * type decides which document types are offered and nothing else changes.
 */
export function DocumentsSection({
  ownerType,
  ownerId,
  documents,
  equipmentTypeOptions = [],
}: {
  ownerType: OwnerType
  ownerId: string
  documents: DocumentWithApprovals[]
  /** Only meaningful for OPERATOR — see DocumentForm.tsx. */
  equipmentTypeOptions?: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // null = nothing open, 'new' = add form, otherwise the id being edited.
  const [openForm, setOpenForm] = useState<string | null>(null)

  const closeForm = useCallback(() => {
    setOpenForm(null)
    router.refresh()
  }, [router])

  function handleDelete(id: string, label: string) {
    if (!confirm(`Delete the ${label}? This cannot be undone.`)) return

    startTransition(async () => {
      await deleteDocument(id)
      router.refresh()
    })
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="font-semibold">Documents</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {documents.length} on file
          </p>
        </div>
        {openForm !== 'new' && (
          <button
            type="button"
            onClick={() => setOpenForm('new')}
            className={buttonSecondaryClass}
          >
            Add document
          </button>
        )}
      </div>

      {openForm === 'new' && (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <DocumentForm
            ownerType={ownerType}
            ownerId={ownerId}
            siblingDocuments={documents}
            equipmentTypeOptions={equipmentTypeOptions}
            action={createDocument}
            onDone={closeForm}
          />
        </div>
      )}

      {documents.length === 0 && openForm !== 'new' ? (
        <p className="px-6 py-10 text-center text-sm text-slate-500">
          No documents recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((document) => (
            <li key={document.id} className="px-6 py-4">
              {openForm === document.id ? (
                <DocumentForm
                  ownerType={ownerType}
                  ownerId={ownerId}
                  document={document}
                  siblingDocuments={documents}
                  equipmentTypeOptions={equipmentTypeOptions}
                  action={updateDocument.bind(null, document.id)}
                  onDone={closeForm}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {documentHeading(document)}
                      </span>
                      <StatusBadge status={document.status} />
                      {document.documentNumber && (
                        <span className="text-xs text-slate-500">
                          {document.documentNumber}
                        </span>
                      )}
                      {document.fileUrl && (
                        <a
                          href={`/api/documents/${document.id}/file${
                            fileActionLabel(document.fileType) === 'Download'
                              ? '?download'
                              : ''
                          }`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
                        >
                          {fileActionLabel(document.fileType)}
                        </a>
                      )}
                    </div>

                    {document.isApplicable && (
                      <p className="mt-1 text-sm text-slate-600">
                        Issued {document.issueDisplay} · Expires{' '}
                        {document.expiryDisplay}
                      </p>
                    )}

                    {document.documentType === THIRD_PARTY_CERTIFICATE &&
                      document.isApplicable && (
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          <p>
                            {document.thirdPartyType ?? '—'}
                            {document.certifiedEquipmentType &&
                              ` · ${document.certifiedEquipmentType}`}
                            {document.issuingCompany &&
                              ` · ${document.issuingCompany}`}
                          </p>
                          <p className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-slate-500">
                              Approved for:
                            </span>
                            {document.approvedFor.length === 0 ? (
                              <span className="text-xs text-amber-700">
                                none recorded
                              </span>
                            ) : (
                              document.approvedFor.map((body) => (
                                <span
                                  key={body}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                                >
                                  {APPROVAL_BODY_LABELS[body]}
                                </span>
                              ))
                            )}
                          </p>
                        </div>
                      )}

                    {document.notes && (
                      <p className="mt-2 text-sm text-slate-500">
                        {document.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setOpenForm(document.id)}
                      className="text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        handleDelete(document.id, document.documentType)
                      }
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
