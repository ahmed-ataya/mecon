import { z } from 'zod'
import { MOBILIZATION_CHARGES } from './mobilization'
import { parseCapacity } from './capacity'
import {
  APPROVAL_BODIES,
  ARRANGEMENTS,
  CAPACITY_UNITS,
  DOCUMENT_TYPES_BY_OWNER,
  EMPLOYEE_CATEGORIES,
  EQUIPMENT_ASSIGNMENT_REASONS,
  OPERATOR_ASSIGNMENT_REASONS,
  OPERATOR_SOURCES,
  OWNER_TYPES,
  RATE_TYPES,
  SITES,
  THIRD_PARTY_CERTIFICATE,
  THIRD_PARTY_TYPES_BY_OWNER,
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

/**
 * Empty form fields arrive as '' — treated as absent, not as empty strings.
 *
 * `.optional()` matters as much as the empty check: a field the form did not
 * RENDER is missing from FormData entirely, so it arrives undefined rather
 * than ''. Without this, hiding a field behind a conditional silently broke
 * the whole submit — the operator cost inputs only exist for a market
 * operator, and their absence failed validation with an error that had nowhere
 * on screen to appear.
 */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value))

/** A YYYY-MM-DD form value becomes a UTC-midnight Date, or null. */
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    value === undefined || value === '' ? null : parseDateInput(value),
  )
  .refine((value) => value !== undefined, { message: 'Invalid date' })

/** A money field in riyals ("137.5") becomes integer halalas. */
const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      const halalas = parseQar(value ?? '')

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
  // Free text — the fleet is not a closed set. See enums.ts.
  type: z.string().trim().min(1, 'Equipment type is required'),
  brand: optionalText,
  model: optionalText,
  /** Year only — a full date would imply precision nobody records. */
  yearOfManufacture: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null

      const year = Number(value)
      const thisYear = new Date().getUTCFullYear()

      if (!Number.isInteger(year) || year < 1950 || year > thisYear + 1) {
        ctx.addIssue({
          code: 'custom',
          message: `Enter a year between 1950 and ${thisYear + 1}`,
        })
        return z.NEVER
      }

      return year
    }),
  capacityValue: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const parsed = parseCapacity(value)

      if (parsed === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Capacity must be a number' })
        return z.NEVER
      }

      return parsed
    }),
  capacityUnit: z.enum(CAPACITY_UNITS, { message: 'Select a unit' }),
  serialNumber: optionalText,
  plateNumber: optionalText,
  notes: optionalText,
})

export type EquipmentInput = z.infer<typeof equipmentSchema>

// --- Operator -------------------------------------------------------------

export const operatorSchema = z.object({
  name: z.string().trim().min(1, 'Operator name is required'),
  // Phase E1 — the business's own staff number, distinct from the system id.
  employeeNumber: optionalText,
  jobTitle: optionalText,
  // General employee list (2026-08-20) — was hardcoded to OPERATOR before
  // this; now a real, user-set field so the form covers the whole workforce.
  category: z.enum(EMPLOYEE_CATEGORIES, { message: 'Select a category' }),
  phone: optionalText,
  nationality: optionalText,
  source: z.enum(OPERATOR_SOURCES, { message: 'Select a source' }),
  notes: optionalText,
  // Phase E3 — payroll. All optional: not every employee has salary data
  // entered yet, and payroll generation skips (never zero-fills) anyone
  // missing basicSalary. Minimum-wage compliance is checked separately
  // (src/lib/payroll.ts's checkMinimumWage), as a warning, not a block.
  basicSalary: moneyField('Basic salary'),
  housingAllowance: moneyField('Housing allowance'),
  transportAllowance: moneyField('Transport allowance'),
  foodAllowance: moneyField('Food allowance'),
  siteAllowance: moneyField('Site allowance'),
  otherAllowance: moneyField('Other allowance'),
  housingProvidedInKind: z.boolean(),
  foodProvidedInKind: z.boolean(),
  bankName: optionalText,
  bankAccountNumber: optionalText,
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
    // Set client-side once the file has finished uploading to Blob — see
    // DocumentForm.tsx. Absent entirely on a save that doesn't touch the
    // file (editing dates on a document that already has one attached).
    fileUrl: optionalText,
    fileName: optionalText,
    fileType: optionalText,
    // Phase B4/F1 — only meaningful when documentType is Other.
    otherLabel: optionalText,
    // Phase B4/F2 — every owner type, always optional.
    notes: optionalText,
    // Phase B4/F5 — only meaningful on an OPERATOR's 3rd party certificate.
    certifiedEquipmentType: optionalText,
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
        THIRD_PARTY_TYPES_BY_OWNER[data.ownerType].includes(
          data.thirdPartyType,
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
  // Other's name field, same shape as the 3rd party fields above: only
  // meaningful for its own document type, required while applicable, a
  // deliberate "doesn't apply" record is allowed to leave it blank.
  .refine((data) => data.documentType === 'Other' || !data.otherLabel, {
    message: 'Document name only applies when the type is Other',
    path: ['otherLabel'],
  })
  .refine(
    (data) =>
      data.documentType !== 'Other' || !data.isApplicable || !!data.otherLabel,
    {
      message: 'Enter a name for this document',
      path: ['otherLabel'],
    },
  )
  // Machine type only means something on an OPERATOR's 3rd party
  // certificate — equipment's own 3rd party certs already have their
  // machine implicit in the owner.
  .refine(
    (data) =>
      (data.ownerType === 'OPERATOR' &&
        data.documentType === THIRD_PARTY_CERTIFICATE) ||
      !data.certifiedEquipmentType,
    {
      message: 'Machine type only applies to an operator 3rd party certificate',
      path: ['certifiedEquipmentType'],
    },
  )
  .refine(
    (data) =>
      !(
        data.ownerType === 'OPERATOR' &&
        data.documentType === THIRD_PARTY_CERTIFICATE
      ) ||
      !data.isApplicable ||
      !!data.certifiedEquipmentType,
    {
      message: 'Select which machine type this certificate covers',
      path: ['certifiedEquipmentType'],
    },
  )
  // Guards against a client bug that sends one without the other — a URL
  // with no name to display, or a name pointing at nothing.
  .refine((data) => Boolean(data.fileUrl) === Boolean(data.fileName), {
    message: 'File upload did not complete — try attaching it again',
    path: ['fileUrl'],
  })

export type DocumentInput = z.infer<typeof documentSchema>

// --- Contract -------------------------------------------------------------

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
    /** Null means "not on an LPO yet" — contracts can precede the paperwork. */
    lpoId: optionalText,
    quotationRef: optionalText,
    mobilizationBy: optionalText,
    /** Blank follows the duration rule — see src/lib/mobilization.ts */
    mobilizationCharge: z
      .string()
      .trim()
      .transform((value) => (value === '' ? null : value))
      .nullable()
      .refine(
        (value) => value === null || MOBILIZATION_CHARGES.includes(value as 'FREE'),
        { message: 'Choose free of charge or charged' },
      ),
    mobilizationAmount: moneyField('Mobilization amount'),
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

// --- LPO ------------------------------------------------------------------

/**
 * A blank amount or expiry is DELIBERATE — it records an open LPO, not an
 * incomplete one. Neither is required, and src/lib/lpo.ts derives the type
 * from which are missing.
 */
export const lpoSchema = z.object({
  customerId: z.string().trim().min(1, 'Select a customer'),
  number: z.string().trim().min(1, 'LPO number is required'),
  issuedDate: optionalDate,
  amount: moneyField('LPO amount'),
  validity: optionalDate,
  notes: optionalText,
})

export type LpoInput = z.infer<typeof lpoSchema>

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
    startDate: requiredDate('Start date'),
    reason: z.enum(OPERATOR_ASSIGNMENT_REASONS, { message: 'Select a reason' }),
    operatorHourlyCost: moneyField('Operator hourly cost'),
    note: optionalText,
  })
  .refine(
    // WITHOUT_OPERATOR is the one arrangement with nobody to name.
    (data) => data.arrangement === 'WITHOUT_OPERATOR' || !!data.operatorId,
    { message: 'Select an operator', path: ['operatorId'] },
  )

export type OperatorAssignmentInput = z.infer<typeof operatorAssignmentSchema>

// --- Timesheets -------------------------------------------------------------

/**
 * Just the "which assignment, which month" picker — the daily rows
 * themselves are validated by hand in the update action (src/lib/actions/
 * timesheets.ts), since a zod array schema over ~30 rows would need
 * per-cell path wiring in the table UI for little real benefit over a
 * clear row-specific error message.
 */
export const timesheetCreateSchema = z.object({
  assignmentId: z.string().min(1, 'Select an assignment'),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export type TimesheetCreateInput = z.infer<typeof timesheetCreateSchema>

// --- Payroll ----------------------------------------------------------------

export const payrollPeriodCreateSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

export type PayrollPeriodCreateInput = z.infer<typeof payrollPeriodCreateSchema>

/** Entered by staff — see RamadanPeriod's model comment for why these
 * dates are never hardcoded. */
export const ramadanPeriodSchema = z
  .object({
    year: z.coerce.number().int().min(2020).max(2100),
    startDate: requiredDate('Start date'),
    endDate: requiredDate('End date'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  })

export type RamadanPeriodInput = z.infer<typeof ramadanPeriodSchema>

/** Flatten zod issues into { field: message } for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    result[key] ??= issue.message
  }

  return result
}
