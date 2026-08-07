import { z } from 'zod'
import {
  APPROVAL_BODIES,
  ARRANGEMENTS,
  DOCUMENT_TYPES_BY_OWNER,
  EQUIPMENT_ASSIGNMENT_REASONS,
  EQUIPMENT_TYPES,
  OPERATOR_ASSIGNMENT_REASONS,
  OPERATOR_SOURCES,
  OWNER_TYPES,
  RATE_TYPES,
  SITES,
  THIRD_PARTY_CERTIFICATE,
  THIRD_PARTY_TYPES,
} from './enums'
import { parseDateInput } from './dates'
import { parseQar } from './money'

/**
 * Runtime validation for everything that reaches the database.
 *
 * Because enums are stored as plain strings (see NOTES.md), these schemas are
 * the real guard against bad data — not a convenience layer. Server actions
 * parse through here before any write.
 */

/** Empty form fields arrive as '' — treat them as absent, not as empty strings. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()

/** A YYYY-MM-DD form value becomes a UTC-midnight Date, or null. */
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : parseDateInput(value)))
  .nullable()
  .refine((value) => value !== undefined, { message: 'Invalid date' })

// --- Customer -------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  contactPerson: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .refine((value) => value === null || z.email().safeParse(value).success, {
      message: 'Enter a valid email address, or leave it blank',
    }),
  notes: optionalText,
})

export type CustomerInput = z.infer<typeof customerSchema>

// --- Equipment ------------------------------------------------------------

export const equipmentSchema = z.object({
  name: z.string().trim().min(1, 'Unit label is required'),
  type: z.enum(EQUIPMENT_TYPES, { message: 'Select an equipment type' }),
  serialNumber: optionalText,
  plateNumber: optionalText,
  notes: optionalText,
})

export type EquipmentInput = z.infer<typeof equipmentSchema>

// --- Operator -------------------------------------------------------------

export const operatorSchema = z.object({
  name: z.string().trim().min(1, 'Operator name is required'),
  phone: optionalText,
  nationality: optionalText,
  source: z.enum(OPERATOR_SOURCES, { message: 'Select a source' }),
  notes: optionalText,
})

export type OperatorInput = z.infer<typeof operatorSchema>

// --- Document -------------------------------------------------------------

export const documentSchema = z
  .object({
    ownerType: z.enum(OWNER_TYPES),
    ownerId: z.string().min(1),
    documentType: z.string().trim().min(1, 'Document type is required'),
    documentNumber: optionalText,
    issueDate: optionalDate,
    expiryDate: optionalDate,
    isApplicable: z.boolean(),
    thirdPartyType: optionalText,
    issuingCompany: optionalText,
    approvedFor: z.array(z.enum(APPROVAL_BODIES)),
  })
  // The allowed document types differ per owner, so this pair has to be
  // checked together rather than field by field.
  .refine(
    (data) => DOCUMENT_TYPES_BY_OWNER[data.ownerType].includes(data.documentType),
    {
      message: 'That document type is not valid for this record',
      path: ['documentType'],
    },
  )
  // Expiry before issue is always a data-entry mistake.
  .refine(
    (data) =>
      !data.issueDate || !data.expiryDate || data.expiryDate >= data.issueDate,
    {
      message: 'Expiry date cannot be before the issue date',
      path: ['expiryDate'],
    },
  )
  // 3rd party details only make sense on a 3rd party certificate.
  .refine(
    (data) =>
      data.documentType === THIRD_PARTY_CERTIFICATE ||
      (!data.thirdPartyType && !data.issuingCompany && data.approvedFor.length === 0),
    {
      message: '3rd party details only apply to a 3rd Party Certificate',
      path: ['thirdPartyType'],
    },
  )
  // An applicable certificate needs its type; a not-applicable one is a
  // deliberate blank record and is allowed to be empty.
  .refine(
    (data) =>
      data.documentType !== THIRD_PARTY_CERTIFICATE ||
      !data.isApplicable ||
      (data.thirdPartyType !== null &&
        THIRD_PARTY_TYPES.includes(
          data.thirdPartyType as (typeof THIRD_PARTY_TYPES)[number],
        )),
    {
      message: 'Select the 3rd party type',
      path: ['thirdPartyType'],
    },
  )
  .refine(
    (data) =>
      data.documentType !== THIRD_PARTY_CERTIFICATE ||
      !data.isApplicable ||
      data.approvedFor.length > 0,
    {
      message: 'Select at least one approval body this certificate is valid for',
      path: ['approvedFor'],
    },
  )

export type DocumentInput = z.infer<typeof documentSchema>

// --- Contract -------------------------------------------------------------

/** A money field in riyals ("137.5") becomes integer halalas. */
const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const halalas = parseQar(value)

      if (halalas === undefined) {
        ctx.addIssue({ code: 'custom', message: `${label} must be a number` })
        return z.NEVER
      }

      return halalas
    })

const requiredMoneyField = (label: string) =>
  moneyField(label).refine((value): value is number => value !== null, {
    message: `${label} is required`,
  })

const requiredDate = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const date = parseDateInput(value)

      if (!date) {
        ctx.addIssue({ code: 'custom', message: `${label} is required` })
        return z.NEVER
      }

      return date
    })

export const contractSchema = z
  .object({
    customerId: z.string().trim().min(1, 'Select a customer'),
    projectName: z.string().trim().min(1, 'Project name is required'),
    // Free text, so nothing is lost when the place is not on any list.
    siteName: z.string().trim().min(1, 'Location is required'),
    // The certification regime, recorded separately from the name.
    siteRegime: z.enum(SITES, { message: 'Select which approval applies' }),
    mobilizationDate: requiredDate('Mobilization date'),
    closingDate: optionalDate,
    lpoNumber: optionalText,
    lpoValidity: optionalDate,
    lpoAmount: moneyField('LPO amount'),
  })
  .refine(
    (data) =>
      !data.closingDate || data.closingDate >= data.mobilizationDate,
    {
      message: 'Closing date cannot be before the mobilization date',
      path: ['closingDate'],
    },
  )

export type ContractInput = z.infer<typeof contractSchema>

// --- Assignments ----------------------------------------------------------

export const equipmentAssignmentSchema = z.object({
  equipmentId: z.string().trim().min(1, 'Select a machine'),
  startDate: requiredDate('Start date'),
  rateType: z.enum(RATE_TYPES, { message: 'Select a rate type' }),
  rateAmount: requiredMoneyField('Rate'),
  reason: z.enum(EQUIPMENT_ASSIGNMENT_REASONS, { message: 'Select a reason' }),
  note: optionalText,
})

export type EquipmentAssignmentInput = z.infer<
  typeof equipmentAssignmentSchema
>

export const operatorAssignmentSchema = z
  .object({
    arrangement: z.enum(ARRANGEMENTS, { message: 'Select an arrangement' }),
    operatorId: optionalText,
    /** Which machine this operator runs — optional, contracts vary. */
    equipmentId: optionalText,
    startDate: requiredDate('Start date'),
    reason: z.enum(OPERATOR_ASSIGNMENT_REASONS, { message: 'Select a reason' }),
    operatorCost: moneyField('Operator cost'),
    operatorRebill: moneyField('Operator rebill'),
    note: optionalText,
  })
  .refine(
    // WITHOUT_OPERATOR is the one arrangement with nobody to name.
    (data) => data.arrangement === 'WITHOUT_OPERATOR' || !!data.operatorId,
    { message: 'Select an operator', path: ['operatorId'] },
  )

export type OperatorAssignmentInput = z.infer<typeof operatorAssignmentSchema>

/** Flatten zod issues into { field: message } for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    result[key] ??= issue.message
  }

  return result
}
