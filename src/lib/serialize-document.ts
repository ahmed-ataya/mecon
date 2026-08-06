import type { Document, DocumentApproval } from '@prisma/client'
import { formatDate, toDateInputValue } from './dates'
import { getDocumentStatus } from './document-status'
import type { ApprovalBody } from './enums'
import type { DocumentWithApprovals } from '@/components/documents/types'

/**
 * Turn a Prisma document into the plain shape client components receive.
 * Dates and status are resolved here, on the server, so no Date object ever
 * reaches the browser — see components/documents/types.ts for why.
 */
export function serializeDocument(
  document: Document & { approvedFor: DocumentApproval[] },
): DocumentWithApprovals {
  return {
    id: document.id,
    documentType: document.documentType,
    documentNumber: document.documentNumber,
    issueDate: toDateInputValue(document.issueDate),
    expiryDate: toDateInputValue(document.expiryDate),
    issueDisplay: formatDate(document.issueDate),
    expiryDisplay: formatDate(document.expiryDate),
    isApplicable: document.isApplicable,
    status: getDocumentStatus(document),
    thirdPartyType: document.thirdPartyType,
    issuingCompany: document.issuingCompany,
    approvedFor: document.approvedFor.map(
      (approval) => approval.body as ApprovalBody,
    ),
  }
}

/** Expired first, then expiring soon — the problems sit at the top. */
export function sortDocumentsByUrgency(documents: DocumentWithApprovals[]) {
  const order = {
    EXPIRED: 0,
    EXPIRING_SOON: 1,
    VALID: 2,
    NO_EXPIRY: 3,
    NOT_APPLICABLE: 4,
  } as const

  return [...documents].sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      a.documentType.localeCompare(b.documentType),
  )
}
