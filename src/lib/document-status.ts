import { daysUntil } from './dates'

/**
 * Document validity, derived from expiryDate every time it is read — never
 * stored, so it cannot go stale between page loads.
 *
 * Colour convention: red blocks, amber warns, green is healthy.
 */

export const EXPIRING_SOON_DAYS = 30

/**
 * Phase E1 — QID and Visa/Residence Permit escalate harder than every other
 * document type: losing either means someone can legally not work, and
 * renewal isn't instant, so staff need more runway than the usual 30 days
 * to act. Everything else keeps the standard window.
 */
export const EXTENDED_ESCALATION_TYPES = ['Qatar ID', 'Visa/Residence Permit']
export const EXTENDED_ESCALATION_DAYS = 60

export type DocumentStatus =
  | 'NOT_APPLICABLE' // deliberately recorded as not required
  | 'NO_EXPIRY' // permanent document, nothing to track
  | 'VALID'
  | 'EXPIRING_SOON'
  | 'EXPIRED'

type DocumentLike = {
  documentType: string
  isApplicable: boolean
  expiryDate: Date | null
}

export function getDocumentStatus(document: DocumentLike): DocumentStatus {
  if (!document.isApplicable) return 'NOT_APPLICABLE'
  if (!document.expiryDate) return 'NO_EXPIRY'

  const days = daysUntil(document.expiryDate)
  const window = EXTENDED_ESCALATION_TYPES.includes(document.documentType)
    ? EXTENDED_ESCALATION_DAYS
    : EXPIRING_SOON_DAYS

  if (days < 0) return 'EXPIRED'
  if (days <= window) return 'EXPIRING_SOON'
  return 'VALID'
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  NOT_APPLICABLE: 'Not applicable',
  NO_EXPIRY: 'No expiry',
  VALID: 'Valid',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
}

/** Tailwind classes per status. Amber warns, red blocks, green is healthy. */
export const DOCUMENT_STATUS_CLASSES: Record<DocumentStatus, string> = {
  NOT_APPLICABLE: 'bg-slate-100 text-slate-600 ring-slate-200',
  NO_EXPIRY: 'bg-slate-100 text-slate-600 ring-slate-200',
  VALID: 'bg-green-50 text-green-700 ring-green-200',
  EXPIRING_SOON: 'bg-amber-50 text-amber-800 ring-amber-200',
  EXPIRED: 'bg-red-50 text-red-700 ring-red-200',
}

/** Worst-first, so the rollup surfaces the most urgent problem. */
const SEVERITY: Record<DocumentStatus, number> = {
  EXPIRED: 4,
  EXPIRING_SOON: 3,
  VALID: 2,
  NO_EXPIRY: 1,
  NOT_APPLICABLE: 0,
}

/**
 * The single worst status across a record's documents — what a Customer,
 * Equipment or Operator row shows at a glance, and what phase 2 puts inline
 * in the searchable dropdowns.
 */
export function rollUpStatus(documents: DocumentLike[]): DocumentStatus {
  if (documents.length === 0) return 'NOT_APPLICABLE'

  return documents.reduce<DocumentStatus>((worst, document) => {
    const status = getDocumentStatus(document)
    return SEVERITY[status] > SEVERITY[worst] ? status : worst
  }, 'NOT_APPLICABLE')
}

/** Counts for a compact summary like "1 expired · 2 expiring". */
export function summarizeStatuses(documents: DocumentLike[]) {
  let expired = 0
  let expiringSoon = 0

  for (const document of documents) {
    const status = getDocumentStatus(document)
    if (status === 'EXPIRED') expired += 1
    if (status === 'EXPIRING_SOON') expiringSoon += 1
  }

  return { expired, expiringSoon, total: documents.length }
}
