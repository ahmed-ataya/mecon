/**
 * Single source of truth for every enumerated value in the system.
 *
 * These live in the database as plain strings rather than native enums (see
 * NOTES.md), which makes this file the only thing standing between the app and
 * bad data — always validate through the zod schemas here before writing.
 *
 * Each group exports: the value tuple, a TS union type, and a label map for
 * display. Storage values are stable identifiers; labels are what users read,
 * so labels can be reworded freely without a migration.
 */

// --- Equipment ------------------------------------------------------------

/**
 * Starting SUGGESTIONS for equipment type, not a closed list.
 *
 * The fleet is not fixed: the master sheet already carries Boom Truck,
 * Telehandler, Motor Grader and Skid Loader, and the next machine bought could
 * be anything. A closed list would force real machines into "Other" and lose
 * what they actually are — the same data loss that made site names free text.
 *
 * The form autocompletes from these plus every type already in use, and
 * accepts anything typed.
 */
export const EQUIPMENT_TYPE_SUGGESTIONS = [
  'Excavator',
  'Wheel Excavator',
  'Mini Excavator',
  'Wheel Loader',
  'Backhoe Loader (JCB)',
  'Skid Loader',
  'Skid Steer (Bobcat)',
  'Boom Truck',
  'Telehandler',
  'Motor Grader',
  'Bulldozer',
  'Crane',
  'Dump Truck',
  'Roller/Compactor',
  'Forklift',
] as const

/**
 * Capacity units. Tonnage covers most of the fleet; metres exists because a
 * telehandler is specified by reach ("17M") rather than by weight.
 */
export const CAPACITY_UNITS = [
  'TON',
  'METRE',
  'KG',
  'CBM',
  'HP',
  'OTHER',
] as const
export type CapacityUnit = (typeof CAPACITY_UNITS)[number]

export const CAPACITY_UNIT_LABELS: Record<CapacityUnit, string> = {
  TON: 'Ton',
  METRE: 'Metre',
  KG: 'kg',
  CBM: 'm³',
  HP: 'HP',
  OTHER: 'Other',
}

// --- Operators ------------------------------------------------------------

export const OPERATOR_SOURCES = ['IN_HOUSE', 'MARKET'] as const
export type OperatorSource = (typeof OPERATOR_SOURCES)[number]

export const OPERATOR_SOURCE_LABELS: Record<OperatorSource, string> = {
  IN_HOUSE: 'In-house',
  MARKET: 'Market',
}

// --- Documents ------------------------------------------------------------

export const OWNER_TYPES = ['CUSTOMER', 'EQUIPMENT', 'OPERATOR'] as const
export type OwnerType = (typeof OWNER_TYPES)[number]

/**
 * Replaced 2026-08-15 — the original list (Trade License, Commercial
 * Registration, VAT Certificate, Company ID / CR Extract, Insurance
 * Certificate) was wrong for what the business actually files under a
 * customer. Existing rows were migrated, not dropped — see the migration
 * dated 20260815120000.
 */
export const CUSTOMER_DOCUMENT_TYPES = [
  'CR (Commercial Registration)',
  'Commercial License',
  'Computer Card',
  'Other',
] as const

/**
 * Gate Pass removed 2026-08-15 — a site pass belongs to the person on site,
 * not the machine. A later phase (see ROADMAP.md) adds it back under
 * OPERATOR_DOCUMENT_TYPES instead; it is not there yet. Inspection Report was
 * never actually used; Permit Sticker was never a real category here either.
 * The one existing equipment Gate Pass row was migrated to Other rather than
 * dropped — see the migration dated 20260815120000.
 */
export const EQUIPMENT_DOCUMENT_TYPES = [
  'Registration (Istimara)',
  'Insurance',
  'Load Test',
  '3rd Party Certificate',
  'Other',
] as const

export const OPERATOR_DOCUMENT_TYPES = [
  'Qatar ID',
  'Driving License',
  'Operator License',
  'Medical Certificate',
  '3rd Party Certificate',
  'Passport',
  'Other',
] as const

/** Allowed document types differ per owner — the form and the validator both read this. */
export const DOCUMENT_TYPES_BY_OWNER: Record<OwnerType, readonly string[]> = {
  CUSTOMER: CUSTOMER_DOCUMENT_TYPES,
  EQUIPMENT: EQUIPMENT_DOCUMENT_TYPES,
  OPERATOR: OPERATOR_DOCUMENT_TYPES,
}

/** The one document type that unlocks the 3rd party fields. */
export const THIRD_PARTY_CERTIFICATE = '3rd Party Certificate'

export const THIRD_PARTY_TYPES = [
  'Lifting Equipment Cert',
  'Load Test',
  'Operator Competency',
  'Vehicle Inspection',
  'Pressure Vessel',
  'Other',
] as const
export type ThirdPartyType = (typeof THIRD_PARTY_TYPES)[number]

// --- Sites and approval bodies -------------------------------------------

export const APPROVAL_BODIES = [
  'GENERAL_DOHA',
  'QATAR_ENERGY',
  'RAS_LAFFAN',
  'MESAIEED',
  'OTHER',
] as const
export type ApprovalBody = (typeof APPROVAL_BODIES)[number]

export const APPROVAL_BODY_LABELS: Record<ApprovalBody, string> = {
  GENERAL_DOHA: 'General Doha',
  QATAR_ENERGY: 'QatarEnergy',
  RAS_LAFFAN: 'Ras Laffan',
  MESAIEED: 'Mesaieed',
  OTHER: 'Other',
}

export const SITES = [
  'DOHA_GENERAL',
  'QATAR_ENERGY',
  'RAS_LAFFAN',
  'MESAIEED',
  'OTHER',
] as const
export type Site = (typeof SITES)[number]

export const SITE_LABELS: Record<Site, string> = {
  DOHA_GENERAL: 'Doha (General)',
  QATAR_ENERGY: 'QatarEnergy',
  RAS_LAFFAN: 'Ras Laffan',
  MESAIEED: 'Mesaieed',
  OTHER: 'Other',
}

/**
 * Which approval body a site demands on a 3rd party certificate.
 *
 * General Doha work accepts any 3rd party certificate. The three operator-run
 * sites only accept certificates from their own approved companies, so a
 * certificate must explicitly carry that body to be valid there.
 * Used by the phase 2 site/certificate check.
 */
export const SITE_REQUIRED_APPROVAL: Record<Site, ApprovalBody | null> = {
  DOHA_GENERAL: null, // any certificate is acceptable
  QATAR_ENERGY: 'QATAR_ENERGY',
  RAS_LAFFAN: 'RAS_LAFFAN',
  MESAIEED: 'MESAIEED',
  OTHER: null,
}

// --- Contracts ------------------------------------------------------------

/**
 * How the hire was ARRANGED — daily, weekly or monthly.
 *
 * This is NOT the unit of the rate. The rate is always an hourly figure (see
 * EquipmentAssignment.rateAmount); nothing divides by the period any more. The
 * arrangement is recorded because it is a real term of the agreement and
 * because a monthly hire that ran four days is worth questioning.
 *
 * Order matters: longest first. The billing warning compares the arrangement
 * against days actually worked, and "is this arrangement longer than the hire"
 * is a position check in this list.
 */
export const RATE_TYPES = ['PER_MONTH', 'PER_WEEK', 'PER_DAY'] as const
export type RateType = (typeof RATE_TYPES)[number]

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  PER_MONTH: 'Monthly',
  PER_WEEK: 'Weekly',
  PER_DAY: 'Daily',
}

/** The period as a bare noun, for "…for a full month". */
export const RATE_TYPE_PERIOD_LABELS: Record<RateType, string> = {
  PER_MONTH: 'month',
  PER_WEEK: 'week',
  PER_DAY: 'day',
}

/**
 * Nominal hours in one full period of each arrangement.
 *
 * The figures come from the working week: a day is 10 hours, and a week is
 * Saturday to Thursday, so 6 x 10 = 60. A month is 26 working days, 26 x 10
 * = 260.
 *
 * Nothing divides the rate by these — the rate is already hourly. They are
 * used to show what a full period comes to at the agreed rate, which is the
 * figure someone can sanity-check a typed rate against.
 */
export const HOURS_PER_WORKING_DAY = 10

export const RATE_TYPE_HOURS: Record<RateType, number> = {
  PER_MONTH: 26 * HOURS_PER_WORKING_DAY,
  PER_WEEK: 6 * HOURS_PER_WORKING_DAY,
  PER_DAY: HOURS_PER_WORKING_DAY,
}

/** Nominal days in each arrangement — used to spot one longer than the hire. */
export const RATE_TYPE_DAYS: Record<RateType, number> = {
  PER_MONTH: 26,
  PER_WEEK: 6,
  PER_DAY: 1,
}

// --- Off hire -------------------------------------------------------------

/**
 * A machine on site but not billable. Taken from the red OFF HIRE rows on the
 * master sheet — without it, invoices bill every calendar day and get disputed.
 */
export const OFF_HIRE_REASONS = [
  'BREAKDOWN',
  'CUSTOMER_STANDDOWN',
  'AWAITING_ACCESS',
  'WEATHER',
  'OTHER',
] as const
export type OffHireReason = (typeof OFF_HIRE_REASONS)[number]

export const OFF_HIRE_REASON_LABELS: Record<OffHireReason, string> = {
  BREAKDOWN: 'Breakdown',
  CUSTOMER_STANDDOWN: 'Customer stand-down',
  AWAITING_ACCESS: 'Awaiting site access',
  WEATHER: 'Weather',
  OTHER: 'Other',
}

// --- Mobilization ---------------------------------------------------------

/** Who physically moves the machine. */
export const MOVED_BY = ['MECON', 'OUTSOURCED', 'CUSTOMER', 'SUPPLIER'] as const
export type MovedBy = (typeof MOVED_BY)[number]

export const MOVED_BY_LABELS: Record<MovedBy, string> = {
  MECON: 'Mecon',
  OUTSOURCED: 'Outsourced transporter',
  CUSTOMER: 'Customer',
  SUPPLIER: 'Cross-hire supplier',
}

// --- Assignments ----------------------------------------------------------

export const EQUIPMENT_ASSIGNMENT_REASONS = [
  'INITIAL',
  'BREAKDOWN_REPLACEMENT',
  'CUSTOMER_REQUEST',
  'SCHEDULED_SWAP',
  'OTHER',
] as const
export type EquipmentAssignmentReason =
  (typeof EQUIPMENT_ASSIGNMENT_REASONS)[number]

export const OPERATOR_ASSIGNMENT_REASONS = [
  'INITIAL',
  'SICK_INJURED',
  'BREAKDOWN_REPLACEMENT',
  'CUSTOMER_REQUEST',
  'SCHEDULED_SWAP',
  'OTHER',
] as const
export type OperatorAssignmentReason =
  (typeof OPERATOR_ASSIGNMENT_REASONS)[number]

export const ASSIGNMENT_REASON_LABELS: Record<string, string> = {
  INITIAL: 'Initial',
  BREAKDOWN_REPLACEMENT: 'Breakdown replacement',
  SICK_INJURED: 'Sick / injured',
  CUSTOMER_REQUEST: 'Customer request',
  SCHEDULED_SWAP: 'Scheduled swap',
  OTHER: 'Other',
}

export const ARRANGEMENTS = [
  'WITH_OPERATOR',
  'WITHOUT_OPERATOR',
  'MARKET_OPERATOR',
] as const
export type Arrangement = (typeof ARRANGEMENTS)[number]

export const ARRANGEMENT_LABELS: Record<Arrangement, string> = {
  WITH_OPERATOR: 'With operator',
  WITHOUT_OPERATOR: 'Without operator',
  MARKET_OPERATOR: 'Market operator',
}

// --- Invoices (phase 3) ---------------------------------------------------

/** Stored lifecycle only. OVERDUE is derived from dueDate — see invoice-status.ts */
export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PAID'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_LINE_KINDS = [
  'EQUIPMENT',
  'OPERATOR_REBILL',
  'MOBILIZATION',
  'DEMOBILIZATION',
  'OTHER',
] as const
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number]

/**
 * The UOM column on the printed invoice.
 *
 * Only two, because hire is always billed in hours whatever the agreed rate,
 * and everything else is a lump sum.
 */
export const UOMS = ['Hours', 'LS'] as const
export type Uom = (typeof UOMS)[number]
