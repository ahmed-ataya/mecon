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

export const EQUIPMENT_TYPES = [
  'Excavator',
  'Wheel Loader',
  'Backhoe Loader (JCB)',
  'Skid Steer (Bobcat)',
  'Bulldozer',
  'Crane',
  'Dump Truck',
  'Roller/Compactor',
  'Forklift',
  'Other',
] as const
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number]

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

export const CUSTOMER_DOCUMENT_TYPES = [
  'Trade License',
  'Commercial Registration',
  'VAT Certificate',
  'Company ID / CR Extract',
  'Insurance Certificate',
  'Other',
] as const

export const EQUIPMENT_DOCUMENT_TYPES = [
  'Registration (Istimara)',
  'Insurance',
  '3rd Party Certificate',
  'Load Test Certificate',
  'Inspection Report',
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

export const RATE_TYPES = ['PER_DAY', 'PER_MONTH', 'PER_WORKING_HOUR'] as const
export type RateType = (typeof RATE_TYPES)[number]

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  PER_DAY: 'Per day',
  PER_MONTH: 'Per month',
  PER_WORKING_HOUR: 'Per working hour',
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
  'OTHER',
] as const
export type InvoiceLineKind = (typeof INVOICE_LINE_KINDS)[number]
