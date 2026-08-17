import { DOCUMENT_TYPES_BY_OWNER, THIRD_PARTY_CERTIFICATE, type OwnerType } from './enums'

/**
 * Phase B4/F6 — how much of a record's document checklist has been looked
 * at, independent of the app's no-check-for-missing-documents gap this was
 * built to close: a type that was simply never touched (no row at all) is
 * the only thing that counts against the bar. Other is excluded entirely —
 * it isn't a fixed checklist item, it's open-ended by design.
 */

export type CompletenessDocument = {
  documentType: string
  isApplicable: boolean
  fileUrl: string | null
  certifiedEquipmentType: string | null
}

export type ProfileCompleteness = {
  percent: number
  addressed: number
  total: number
  /** Human-readable labels for what's still outstanding, in checklist order. */
  remaining: string[]
}

function normalizeType(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

/**
 * A document counts as addressed once it's either a deliberate
 * "not applicable" record, or an applicable one with its file actually
 * attached — matching just the record fields (dates, a number typed in)
 * isn't enough on its own, since the whole point of Phase C was having the
 * real paperwork on file, not just a date entered.
 *
 * Expiry never affects this — an expired document was still addressed at
 * some point, it's just stale now. That's a separate concern, already
 * covered by the Valid/Expiring/Expired badges and the warnings system.
 */
function isAddressed(document: CompletenessDocument): boolean {
  return !document.isApplicable || Boolean(document.fileUrl)
}

/**
 * `qualifiedMachineTypes` (operators only — from OperatorQualification, see
 * Phase B2) makes the 3rd Party Certificate item machine-specific: Phase
 * B4/F5's whole point was that one certificate does not cover every machine
 * an operator runs, so "at least one certificate on file" would hide real
 * gaps. Each qualified machine becomes its own slot, only collapsed back to
 * a single item when there's nothing to check coverage against (no
 * qualifications recorded), or once any 3rd Party Certificate row is
 * explicitly marked not applicable — a deliberate "certification doesn't
 * apply to this operator" decision that overrides the per-machine
 * breakdown.
 */
export function computeCompleteness(
  ownerType: OwnerType,
  documents: CompletenessDocument[],
  qualifiedMachineTypes: string[] = [],
): ProfileCompleteness {
  const checklist = DOCUMENT_TYPES_BY_OWNER[ownerType].filter(
    (type) => type !== 'Other',
  )

  let addressed = 0
  let total = 0
  const remaining: string[] = []

  for (const type of checklist) {
    const rows = documents.filter((d) => d.documentType === type)
    const isOperatorCertificate =
      ownerType === 'OPERATOR' && type === THIRD_PARTY_CERTIFICATE
    const declaredNotApplicable = rows.some((d) => !d.isApplicable)

    if (
      isOperatorCertificate &&
      qualifiedMachineTypes.length > 0 &&
      !declaredNotApplicable
    ) {
      for (const machineType of qualifiedMachineTypes) {
        total += 1

        const covered = rows.some(
          (d) =>
            d.isApplicable &&
            Boolean(d.fileUrl) &&
            normalizeType(d.certifiedEquipmentType) === normalizeType(machineType),
        )

        if (covered) {
          addressed += 1
        } else {
          remaining.push(`${THIRD_PARTY_CERTIFICATE} — ${machineType}`)
        }
      }
      continue
    }

    total += 1

    if (rows.some(isAddressed)) {
      addressed += 1
    } else {
      remaining.push(type)
    }
  }

  const percent = total === 0 ? 100 : Math.round((addressed / total) * 100)

  return { percent, addressed, total, remaining }
}
