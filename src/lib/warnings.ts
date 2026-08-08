import { daysUntil, formatDate } from './dates'
import { getDocumentStatus, type DocumentStatus } from './document-status'
import {
  SITE_LABELS,
  SITE_REQUIRED_APPROVAL,
  THIRD_PARTY_CERTIFICATE,
  type Site,
} from './enums'

/**
 * Every warning surfaced in phase 2 — on the contract form while typing, on
 * the contract detail page, and on the master view cards.
 *
 * Nothing here ever blocks a save. The business knowingly proceeds sometimes
 * (a machine goes out while a certificate is being renewed), and a system that
 * refuses would just be worked around outside the system, which is worse.
 *
 * Severity follows the project colour convention: RED is a real compliance or
 * legal problem, AMBER is "watch this". Neither stops a submission.
 */
export type WarningSeverity = 'RED' | 'AMBER'

export type Warning = {
  code: string
  severity: WarningSeverity
  message: string
}

export const WARNING_CLASSES: Record<WarningSeverity, string> = {
  RED: 'bg-red-50 text-red-700 ring-red-200',
  AMBER: 'bg-amber-50 text-amber-800 ring-amber-200',
}

type DocumentLike = {
  documentType: string
  documentNumber: string | null
  isApplicable: boolean
  expiryDate: Date | null
}

type CertificateLike = DocumentLike & {
  approvedFor: { body: string }[]
}

/** RED outranks AMBER, so the worst problem is what a card leads with. */
export function worstSeverity(warnings: Warning[]): WarningSeverity | null {
  if (warnings.length === 0) return null
  return warnings.some((warning) => warning.severity === 'RED') ? 'RED' : 'AMBER'
}

// ---------------------------------------------------------------------------
// Document expiry
// ---------------------------------------------------------------------------

/**
 * Expired and soon-to-expire documents on one record.
 *
 * `subject` names the record in the message ("Al Bandary Contracting",
 * "CAT 320 #4") so a warning still makes sense on the master view, far away
 * from the record it came from.
 */
export function documentWarnings(
  subject: string,
  documents: DocumentLike[],
): Warning[] {
  const warnings: Warning[] = []

  for (const document of documents) {
    const status: DocumentStatus = getDocumentStatus(document)

    if (status === 'EXPIRED') {
      warnings.push({
        code: 'DOCUMENT_EXPIRED',
        severity: 'RED',
        message: `${subject}: ${document.documentType} expired ${formatDate(
          document.expiryDate,
        )}.`,
      })
    }

    if (status === 'EXPIRING_SOON') {
      const days = daysUntil(document.expiryDate!)
      warnings.push({
        code: 'DOCUMENT_EXPIRING_SOON',
        severity: 'AMBER',
        message: `${subject}: ${document.documentType} expires in ${days} day${
          days === 1 ? '' : 's'
        } (${formatDate(document.expiryDate)}).`,
      })
    }
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Site-based 3rd party certification
// ---------------------------------------------------------------------------

/**
 * The rule that makes this domain specific: general Doha work accepts any 3rd
 * party certificate, but QatarEnergy, Ras Laffan and Mesaieed only accept
 * certificates issued by their own approved companies.
 *
 * An expired certificate does not count as covering the site — it is reported
 * by documentWarnings separately, but it must not satisfy this check.
 */
export function siteApprovalWarning(
  equipmentName: string,
  site: Site,
  documents: CertificateLike[],
  siteName?: string,
): Warning | null {
  const required = SITE_REQUIRED_APPROVAL[site]

  // General Doha and Other accept any certificate.
  if (!required) return null

  // Name the actual place when we have it, falling back to the regime label.
  const where = siteName ? `${siteName} (${SITE_LABELS[site]})` : SITE_LABELS[site]

  const certificates = documents.filter(
    (document) =>
      document.documentType === THIRD_PARTY_CERTIFICATE && document.isApplicable,
  )

  if (certificates.length === 0) {
    return {
      code: 'CERTIFICATE_MISSING',
      severity: 'RED',
      message: `${equipmentName} has no 3rd party certificate on file, and ${where} requires one from an approved company.`,
    }
  }

  const covering = certificates.filter(
    (certificate) =>
      getDocumentStatus(certificate) !== 'EXPIRED' &&
      certificate.approvedFor.some((approval) => approval.body === required),
  )

  if (covering.length > 0) return null

  const expiredButCovering = certificates.some(
    (certificate) =>
      getDocumentStatus(certificate) === 'EXPIRED' &&
      certificate.approvedFor.some((approval) => approval.body === required),
  )

  return {
    code: 'CERTIFICATE_NOT_APPROVED_FOR_SITE',
    severity: 'RED',
    message: expiredButCovering
      ? `${equipmentName}: the only certificate approved for ${where} has expired.`
      : `${equipmentName}: 3rd party certificate is not approved for ${where}.`,
  }
}

// ---------------------------------------------------------------------------
// Double-booking
// ---------------------------------------------------------------------------

/**
 * A machine cannot be on two sites at once. Not in the original spec, but a
 * scheduling mistake here is expensive and easy to make once the yard is busy.
 *
 * AMBER rather than RED: overlapping dates are sometimes entered deliberately
 * while a swap is being planned, and this warns rather than accuses.
 */
export function doubleBookingWarning(
  equipmentName: string,
  clashes: { projectName: string }[],
): Warning | null {
  if (clashes.length === 0) return null

  const projects = clashes.map((clash) => clash.projectName).join(', ')

  return {
    code: 'EQUIPMENT_DOUBLE_BOOKED',
    severity: 'AMBER',
    message: `${equipmentName} overlaps with ${
      clashes.length === 1 ? 'another contract' : `${clashes.length} other contracts`
    }: ${projects}.`,
  }
}
