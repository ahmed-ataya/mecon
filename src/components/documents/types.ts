import type { ApprovalBody } from '@/lib/enums'
import type { DocumentStatus } from '@/lib/document-status'

/**
 * Documents as they cross from server components into client components.
 *
 * Dates are serialised twice on purpose: `issueDate`/`expiryDate` as
 * YYYY-MM-DD for the form inputs, and `issueDisplay`/`expiryDisplay` as
 * DD MMM YYYY for reading. The client therefore never touches a Date object,
 * which keeps local-timezone conversion — and the off-by-one-day bug it causes
 * — out of the browser entirely. `status` is derived server-side for the same
 * reason.
 */
export type DocumentWithApprovals = {
  id: string
  documentType: string
  documentNumber: string | null
  issueDate: string
  expiryDate: string
  issueDisplay: string
  expiryDisplay: string
  isApplicable: boolean
  status: DocumentStatus
  thirdPartyType: string | null
  issuingCompany: string | null
  certifiedEquipmentType: string | null
  approvedFor: ApprovalBody[]
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  otherLabel: string | null
  notes: string | null
}
