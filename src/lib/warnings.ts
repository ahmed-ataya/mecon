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
// Operator site eligibility — Phase B3
// ---------------------------------------------------------------------------

type OperatorCertificateLike = DocumentLike & {
  thirdPartyType: string | null
  certifiedEquipmentType: string | null
}

/** Trim + lowercase — the same free-text vocabulary as Equipment.type and
 * OperatorQualification.equipmentType, compared the same forgiving way
 * loadEquipmentTypeOptions already dedupes it. */
function normalizeEquipmentType(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

/**
 * QatarEnergy specifically requires the assigned operator to hold all three:
 * a valid TPC/QE 3rd party certificate FOR THE MACHINE TYPE BEING ASSIGNED
 * (Assessment alone does not count — see THIRD_PARTY_TYPES_BY_OWNER; nor
 * does a TPC/QE held for a different machine — Phase B4/F5), a valid H2S
 * Certificate, a valid Defensive Driving Certificate.
 *
 * QatarEnergy ONLY — confirmed deliberately, not assumed. This is NOT the
 * same three-site list siteApprovalWarning uses (QatarEnergy, Ras Laffan,
 * Mesaieed): that rule is about which company issued an equipment
 * certificate, this one is specific operator competencies QatarEnergy alone
 * requires.
 *
 * One warning per unmet requirement rather than a single bundled one, so
 * whoever reads it sees exactly what is missing, not just that something is.
 *
 * `machineType` is the equipment type currently being assigned alongside
 * this operator — null when that isn't known yet (e.g. the contract form
 * before a machine has been picked), in which case the TPC/QE check falls
 * back to "holds one for any machine" rather than guessing wrong.
 */
export function operatorSiteEligibilityWarnings(
  operatorName: string,
  site: Site,
  documents: OperatorCertificateLike[],
  machineType: string | null,
  siteName?: string,
): Warning[] {
  if (site !== 'QATAR_ENERGY') return []

  const where = siteName ? `${siteName} (${SITE_LABELS[site]})` : SITE_LABELS[site]

  const holds = (matches: (document: OperatorCertificateLike) => boolean) =>
    documents.some(
      (document) =>
        document.isApplicable &&
        getDocumentStatus(document) !== 'EXPIRED' &&
        matches(document),
    )

  const warnings: Warning[] = []

  // --- TPC/QE: machine-specific (Phase B4/F5) --------------------------
  const isTpcQe = (d: OperatorCertificateLike) =>
    d.documentType === THIRD_PARTY_CERTIFICATE && d.thirdPartyType === 'TPC/QE'
  const matchesMachine = (d: OperatorCertificateLike) =>
    machineType === null ||
    normalizeEquipmentType(d.certifiedEquipmentType) === normalizeEquipmentType(machineType)

  const heldTpcQe = documents.filter(isTpcQe)
  const hasValidForMachine = heldTpcQe.some(
    (d) =>
      d.isApplicable && getDocumentStatus(d) !== 'EXPIRED' && matchesMachine(d),
  )

  if (!hasValidForMachine) {
    const forThisMachine = heldTpcQe.filter(matchesMachine)

    if (heldTpcQe.length === 0) {
      warnings.push({
        code: 'OPERATOR_MISSING_TPC_QE',
        severity: 'RED',
        message:
          `${operatorName} has no TPC/QE 3rd party certificate on file, and ` +
          `${where} requires one${machineType ? ` for ${machineType}` : ''}. ` +
          'An Assessment certificate is not sufficient.',
      })
    } else if (forThisMachine.length > 0) {
      // Holds one for this exact machine, but it's not currently valid —
      // expired, almost always; matchesMachine ignores validity on purpose
      // so this branch can tell that apart from "wrong machine" below.
      warnings.push({
        code: 'OPERATOR_TPC_QE_EXPIRED',
        severity: 'RED',
        message:
          `${operatorName}'s TPC/QE 3rd party certificate for ${machineType} ` +
          `is not currently valid, and ${where} requires one.`,
      })
    } else {
      const heldFor = [
        ...new Set(heldTpcQe.map((d) => d.certifiedEquipmentType).filter(Boolean)),
      ].join(', ')
      warnings.push({
        code: 'OPERATOR_TPC_QE_WRONG_MACHINE',
        severity: 'RED',
        message:
          `${operatorName} holds a TPC/QE 3rd party certificate for ` +
          `${heldFor || 'a different machine type'}, not ${machineType}, and ` +
          `${where} requires one for the machine being assigned.`,
      })
    }
  }

  // --- H2S / Defensive Driving: unchanged, machine-independent ---------
  const otherChecks: { code: string; label: string; matches: (d: OperatorCertificateLike) => boolean }[] = [
    {
      code: 'OPERATOR_MISSING_H2S',
      label: 'H2S Certificate',
      matches: (d) => d.documentType === 'H2S Certificate',
    },
    {
      code: 'OPERATOR_MISSING_DEFENSIVE_DRIVING',
      label: 'Defensive Driving Certificate',
      matches: (d) => d.documentType === 'Defensive Driving Certificate',
    },
  ]

  warnings.push(
    ...otherChecks
      .filter((check) => !holds(check.matches))
      .map((check) => ({
        code: check.code,
        severity: 'RED' as const,
        message: `${operatorName} has no valid ${check.label} on file, and ${where} requires one.`,
      })),
  )

  return warnings
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
