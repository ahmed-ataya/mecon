'use client'

import { upload } from '@vercel/blob/client'
import { type ChangeEvent, useActionState, useEffect, useRef, useState } from 'react'
import {
  APPROVAL_BODIES,
  APPROVAL_BODY_LABELS,
  DOCUMENT_FILE_ACCEPT,
  DOCUMENT_FILE_ALLOWED_TYPES,
  DOCUMENT_FILE_MAX_BYTES,
  DOCUMENT_TYPES_BY_OWNER,
  THIRD_PARTY_CERTIFICATE,
  THIRD_PARTY_TYPES_BY_OWNER,
  type OwnerType,
} from '@/lib/enums'
import { permitExceedsRegistration } from '@/lib/equipment-warnings'
import { Combobox } from '@/components/ui/Combobox'
import { Select } from '@/components/ui/Select'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/documents'
import type { DocumentWithApprovals } from './types'

/**
 * Add/edit form for a document on any owner type.
 *
 * Two behaviours matter here:
 *  - "Applicable" unchecked records a deliberate "does not apply to this
 *    record", which is different from simply leaving the document off.
 *  - Choosing 3rd Party Certificate expands the certificate-specific fields.
 *    Those fields stay mounted only while that type is selected, and the
 *    server drops any stale values if the type was switched before saving.
 */

/**
 * What staff actually need on file to avoid opening the PDF — not a generic
 * "document number." One stored column (documentNumber); only the label
 * changes, based on the type currently selected. Confirmed against every
 * caller before this existed: nothing reads the VALUE of documentNumber for
 * any logic, it is display-only, so relabeling it needed no migration.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/**
 * DD MMM YYYY from a YYYY-MM-DD string — NOT via `new Date(string)`, which
 * would parse as UTC midnight and then print in the browser's local
 * timezone, silently shifting the displayed day. Split, don't parse.
 */
function formatDateString(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`
}

function documentNumberLabel(documentType: string): string {
  switch (documentType) {
    case 'Insurance':
      return 'Policy Number'
    case THIRD_PARTY_CERTIFICATE:
      return 'Certificate Number'
    case 'Registration (Istimara)':
      return 'Registration Number'
    default:
      return 'Document number'
  }
}

/**
 * Where the file lands in the Blob store. Owner-scoped so a listing (were one
 * ever built) could be filtered by prefix; the filename component is
 * cosmetic only — `addRandomSuffix` on the server is what actually
 * guarantees uniqueness, this just keeps the URL readable.
 */
function blobPathname(ownerType: OwnerType, ownerId: string, fileName: string) {
  const safeName = fileName.trim().replace(/[^a-zA-Z0-9.\-_]+/g, '-').slice(-120)
  return `documents/${ownerType}/${ownerId}/${safeName}`
}

type FileInfo = { url: string; name: string; type: string }

export function DocumentForm({
  ownerType,
  ownerId,
  document,
  siblingDocuments = [],
  equipmentTypeOptions = [],
  action,
  onDone,
}: {
  ownerType: OwnerType
  ownerId: string
  document?: DocumentWithApprovals
  /** Every OTHER document already on this owner — this document included is
   * harmless, since the checks below only ever look for a DIFFERENT type
   * (Registration) than the one being edited (Other). Used to validate on
   * entry rather than only after saving. */
  siblingDocuments?: DocumentWithApprovals[]
  /** Only meaningful for an OPERATOR's 3rd party certificate — which machine
   * type it covers. Unused (and left empty) by the other two owner types. */
  equipmentTypeOptions?: { value: string; label: string }[]
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  // After a failed submit, fall back to what was typed rather than to the
  // stored record — otherwise the form reset discards it.
  const values = state.values
  const initial = {
    documentType:
      values?.documentType ??
      document?.documentType ??
      DOCUMENT_TYPES_BY_OWNER[ownerType][0],
    isApplicable: values?.isApplicable ?? document?.isApplicable ?? true,
    documentNumber: values?.documentNumber ?? document?.documentNumber ?? '',
    issueDate: values?.issueDate ?? document?.issueDate ?? '',
    expiryDate: values?.expiryDate ?? document?.expiryDate ?? '',
    thirdPartyType: values?.thirdPartyType ?? document?.thirdPartyType ?? '',
    issuingCompany: values?.issuingCompany ?? document?.issuingCompany ?? '',
    certifiedEquipmentType:
      values?.certifiedEquipmentType ?? document?.certifiedEquipmentType ?? '',
    approvedFor: values?.approvedFor ?? document?.approvedFor ?? [],
    fileUrl: values?.fileUrl ?? document?.fileUrl ?? '',
    fileName: values?.fileName ?? document?.fileName ?? '',
    fileType: values?.fileType ?? document?.fileType ?? '',
    otherLabel: values?.otherLabel ?? document?.otherLabel ?? '',
    notes: values?.notes ?? document?.notes ?? '',
  }

  // These drive the conditional sections below as well as the submitted value.
  const [documentType, setDocumentType] = useState(initial.documentType)
  const [isApplicable, setIsApplicable] = useState(initial.isApplicable)
  const [expiryDate, setExpiryDate] = useState(initial.expiryDate)

  // The file itself never travels through this form's submit — it goes
  // straight to Blob storage on selection (see handleFileChange), and only
  // the resulting URL rides along as a hidden field. `fileInfo` is what will
  // actually be saved; it starts as whatever's already on the record.
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(
    initial.fileUrl
      ? { url: initial.fileUrl, name: initial.fileName, type: initial.fileType }
      : null,
  )
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Clear the input so selecting the same file again (e.g. retrying after
    // an error) still fires a change event.
    event.target.value = ''
    if (!file) return

    if (!DOCUMENT_FILE_ALLOWED_TYPES.includes(file.type as (typeof DOCUMENT_FILE_ALLOWED_TYPES)[number])) {
      setUploadError('That file type is not supported. Attach a PDF or an image.')
      return
    }
    if (file.size > DOCUMENT_FILE_MAX_BYTES) {
      setUploadError(
        `That file is too large — the limit is ${DOCUMENT_FILE_MAX_BYTES / (1024 * 1024)}MB.`,
      )
      return
    }

    setUploadError(null)
    setUploading(true)
    setUploadProgress(0)

    try {
      const blob = await upload(
        blobPathname(ownerType, ownerId, file.name),
        file,
        {
          // Private: Vercel no longer offers public stores for new accounts,
          // and a real access check beats an unguessable-URL security model
          // anyway. Reading it back — DocumentsSection's View/Download link
          // and the "on file" line below — goes through
          // /api/documents/[id]/file, which holds the read-write token
          // server-side; the raw Blob URL is never exposed to the browser.
          access: 'private',
          handleUploadUrl: '/api/documents/upload',
          contentType: file.type,
          onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
        },
      )
      setFileInfo({ url: blob.url, name: file.name, type: file.type })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed — try again.')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  const isThirdParty = documentType === THIRD_PARTY_CERTIFICATE
  const isOther = documentType === 'Other'
  const isOperatorThirdParty = ownerType === 'OPERATOR' && isThirdParty

  // A4: a permit/sticker recorded under Other must not outlive the machine's
  // own Registration (Istimara) — validated here, as it is entered, not only
  // after saving. Silent whenever there is nothing to compare against.
  const registrationDocument = siblingDocuments.find(
    (doc) => doc.documentType === 'Registration (Istimara)' && doc.isApplicable,
  )
  const permitExceedsRegistrationNow =
    ownerType === 'EQUIPMENT' &&
    documentType === 'Other' &&
    isApplicable &&
    !!expiryDate &&
    !!registrationDocument?.expiryDate &&
    permitExceedsRegistration(expiryDate, registrationDocument.expiryDate)

  // React resets the <form> after every action, including a failed one. Text
  // inputs survive that because React writes their defaultValue as a real DOM
  // attribute and a reset restores from attributes — so re-rendering them from
  // the echoed values is enough. A checkbox does NOT: React applies `checked`
  // as a property and a reset restores from the `defaultChecked` attribute
  // instead, so re-applying it after every commit keeps it in step with the
  // state that is actually submitted. Document type used to need the same
  // treatment; it is a Select now, which handles this itself.
  const applicableRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (applicableRef.current) applicableRef.current.checked = isApplicable
  })

  // Close the panel once the server confirms the write.
  useEffect(() => {
    if (state.ok) onDone()
  }, [state.ok, onDone])

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="ownerType" value={ownerType} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="fileUrl" value={fileInfo?.url ?? ''} />
      <input type="hidden" name="fileName" value={fileInfo?.name ?? ''} />
      <input type="hidden" name="fileType" value={fileInfo?.type ?? ''} />

      <FormError message={errors.form} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Document type" htmlFor="documentType">
          <Select
            name="documentType"
            options={DOCUMENT_TYPES_BY_OWNER[ownerType].map((type) => ({
              value: type,
              label: type,
            }))}
            defaultValue={initial.documentType}
            onSelect={setDocumentType}
          />
          {errors.documentType && (
            <p className="mt-1 text-xs text-red-600">{errors.documentType}</p>
          )}
        </Field>

        <Field label={documentNumberLabel(documentType)} htmlFor="documentNumber">
          <input
            id="documentNumber"
            name="documentNumber"
            defaultValue={initial.documentNumber}
            className={inputClass}
          />
        </Field>
      </div>

      {isOther && (
        <Field
          label="Document name"
          htmlFor="otherLabel"
          hint="What is it? e.g. Fire Extinguisher Certificate."
        >
          <input
            id="otherLabel"
            name="otherLabel"
            defaultValue={initial.otherLabel}
            className={inputClass}
          />
          {errors.otherLabel && (
            <p className="mt-1 text-xs text-red-600">{errors.otherLabel}</p>
          )}
        </Field>
      )}

      <Field
        label="File"
        htmlFor="file"
        hint="PDF or image, up to 20MB."
      >
        {fileInfo && (
          <p className="mb-2 text-sm text-slate-600">
            {/* Only a saved document has a working /file route — a brand
                new upload, or a replacement not yet saved, has nowhere to
                link to yet (the Blob URL itself is private and never sent
                to the browser as a link). */}
            {document && fileInfo.url === document.fileUrl ? (
              <a
                href={`/api/documents/${document.id}/file`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-slate-900 underline hover:text-slate-700"
              >
                {fileInfo.name}
              </a>
            ) : (
              <span className="font-medium text-slate-900">{fileInfo.name}</span>
            )}{' '}
            {document && fileInfo.url === document.fileUrl
              ? 'on file.'
              : 'selected — saved with this document.'}
          </p>
        )}
        <input
          id="file"
          type="file"
          accept={DOCUMENT_FILE_ACCEPT}
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50"
        />
        {uploading && (
          <p className="mt-1 text-xs text-slate-500">
            Uploading{uploadProgress !== null ? ` — ${Math.round(uploadProgress)}%` : '…'}
          </p>
        )}
        {uploadError && (
          <p className="mt-1 text-xs text-red-600">{uploadError}</p>
        )}
        {errors.fileUrl && (
          <p className="mt-1 text-xs text-red-600">{errors.fileUrl}</p>
        )}
      </Field>

      {/* Applicability is a deliberate record, not a blank — so it sits above
          the dates it switches off. */}
      <label className="flex items-start gap-3 rounded-md bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200">
        <input
          type="checkbox"
          name="isApplicable"
          ref={applicableRef}
          defaultChecked={initial.isApplicable}
          onChange={(event) => setIsApplicable(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span className="text-sm">
          <span className="font-medium text-slate-800">Applicable</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Uncheck to record that this document does not apply to this record.
            It will be kept on file as a decision rather than a gap.
          </span>
        </span>
      </label>

      {isApplicable && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Issue date" htmlFor="issueDate">
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              defaultValue={initial.issueDate}
              className={inputClass}
            />
          </Field>

          <Field
            label="Expiry date"
            htmlFor="expiryDate"
            hint="Leave blank if the document does not expire."
          >
            <input
              id="expiryDate"
              name="expiryDate"
              type="date"
              defaultValue={initial.expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              className={inputClass}
            />
            {errors.expiryDate && (
              <p className="mt-1 text-xs text-red-600">{errors.expiryDate}</p>
            )}
          </Field>
        </div>
      )}

      {permitExceedsRegistrationNow && registrationDocument?.expiryDate && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          This expires {formatDateString(expiryDate)}, after Registration
          (Istimara) expires {formatDateString(registrationDocument.expiryDate)}.
          Not blocked — check the permit&apos;s real expiry or that the
          registration needs renewing too.
        </p>
      )}

      {isThirdParty && (
        <fieldset className="space-y-5 rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">
            3rd party certificate details
          </legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="3rd party type" htmlFor="thirdPartyType">
              <Select
                name="thirdPartyType"
                options={THIRD_PARTY_TYPES_BY_OWNER[ownerType].map((type) => ({
                  value: type,
                  label: type,
                }))}
                defaultValue={initial.thirdPartyType}
                placeholder="Select…"
              />
              {errors.thirdPartyType && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.thirdPartyType}
                </p>
              )}
            </Field>

            {isOperatorThirdParty && (
              <Field
                label="Machine type"
                htmlFor="certifiedEquipmentType"
                hint="Which machine this certificate covers — a separate certificate per machine type."
              >
                <Combobox
                  name="certifiedEquipmentType"
                  options={equipmentTypeOptions}
                  defaultValue={initial.certifiedEquipmentType}
                  placeholder="e.g. Skid Loader, Wheel Loader"
                  allowCustom
                />
                {errors.certifiedEquipmentType && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.certifiedEquipmentType}
                  </p>
                )}
              </Field>
            )}

            <Field
              label="Issuing company"
              htmlFor="issuingCompany"
              hint="e.g. Bureau Veritas, SGS, TÜV"
            >
              <input
                id="issuingCompany"
                name="issuingCompany"
                defaultValue={initial.issuingCompany}
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Approved for
            </span>
            <p className="mb-2 text-xs text-slate-500">
              QatarEnergy, Ras Laffan and Mesaieed only accept certificates from
              their own approved companies. Tick every site regime this
              certificate is valid for.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {APPROVAL_BODIES.map((body) => (
                <label
                  key={body}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="approvedFor"
                    value={body}
                    defaultChecked={initial.approvedFor.includes(body)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {APPROVAL_BODY_LABELS[body]}
                </label>
              ))}
            </div>
            {errors.approvedFor && (
              <p className="mt-1 text-xs text-red-600">{errors.approvedFor}</p>
            )}
          </div>
        </fieldset>
      )}

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={initial.notes}
          className={inputClass}
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || uploading}
          className={buttonPrimaryClass}
        >
          {pending
            ? 'Saving…'
            : uploading
              ? 'Uploading…'
              : document
                ? 'Save document'
                : 'Add document'}
        </button>
        <button type="button" onClick={onDone} className={buttonSecondaryClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
