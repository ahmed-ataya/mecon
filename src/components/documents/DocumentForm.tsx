'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import {
  APPROVAL_BODIES,
  APPROVAL_BODY_LABELS,
  DOCUMENT_TYPES_BY_OWNER,
  THIRD_PARTY_CERTIFICATE,
  THIRD_PARTY_TYPES,
  type OwnerType,
} from '@/lib/enums'
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
export function DocumentForm({
  ownerType,
  ownerId,
  document,
  action,
  onDone,
}: {
  ownerType: OwnerType
  ownerId: string
  document?: DocumentWithApprovals
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
    approvedFor: values?.approvedFor ?? document?.approvedFor ?? [],
  }

  // These drive the conditional sections below as well as the submitted value.
  const [documentType, setDocumentType] = useState(initial.documentType)
  const [isApplicable, setIsApplicable] = useState(initial.isApplicable)

  const isThirdParty = documentType === THIRD_PARTY_CERTIFICATE

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
              className={inputClass}
            />
            {errors.expiryDate && (
              <p className="mt-1 text-xs text-red-600">{errors.expiryDate}</p>
            )}
          </Field>
        </div>
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
                options={THIRD_PARTY_TYPES.map((type) => ({
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

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : document ? 'Save document' : 'Add document'}
        </button>
        <button type="button" onClick={onDone} className={buttonSecondaryClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
