import { formatDate, toDateInputValue } from './dates'
import type { Warning } from './warnings'

/**
 * Where a permit or sticker is recorded under Other on a machine, its expiry
 * must not run past that machine's Registration (Istimara) — the
 * registration is what makes the machine legal to be on site at all, and a
 * permit dated to outlive it is not a date anyone should rely on.
 *
 * Compared as YYYY-MM-DD strings on purpose: that format sorts exactly like
 * the dates it represents, and it is what both sides already have without
 * conversion — the server via toDateInputValue, the browser form because it
 * never touches a Date object to begin with (see
 * src/components/documents/types.ts). One comparison, used both places,
 * rather than two implementations that could drift apart.
 */
export function permitExceedsRegistration(
  otherExpiry: string,
  registrationExpiry: string,
): boolean {
  return otherExpiry > registrationExpiry
}

type EquipmentDocumentLike = {
  documentType: string
  documentNumber: string | null
  expiryDate: Date | null
  isApplicable: boolean
}

/**
 * Every document under Other on this machine whose expiry outruns the
 * Registration (Istimara) expiry. Silent, not a false positive, when there is
 * no applicable Registration on file or it has no expiry recorded — nothing
 * to compare against.
 */
export function permitExceedsRegistrationWarnings(
  equipmentName: string,
  documents: EquipmentDocumentLike[],
): Warning[] {
  const registration = documents.find(
    (doc) => doc.documentType === 'Registration (Istimara)' && doc.isApplicable,
  )
  if (!registration?.expiryDate) return []

  const registrationExpiry = toDateInputValue(registration.expiryDate)

  return documents
    .filter(
      (doc) =>
        doc.documentType === 'Other' &&
        doc.isApplicable &&
        doc.expiryDate &&
        permitExceedsRegistration(
          toDateInputValue(doc.expiryDate),
          registrationExpiry,
        ),
    )
    .map((doc) => ({
      code: 'PERMIT_EXCEEDS_REGISTRATION',
      severity: 'AMBER',
      message:
        `${equipmentName}: ${
          doc.documentNumber ? `document ${doc.documentNumber}` : 'a document under Other'
        } expires ${formatDate(doc.expiryDate)}, after Registration (Istimara) ` +
        `expires ${formatDate(registration.expiryDate)}.`,
    }))
}
