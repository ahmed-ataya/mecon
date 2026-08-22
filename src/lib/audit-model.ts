/**
 * Turns an AuditLog row's raw `entityType`/`entityId` into what the UI
 * actually shows — a human model name and, where one exists, a link to
 * the record's own detail page. Centralised here so the audit list page
 * and every record's own "Change history" panel (Stage 3) read it the
 * same way and can never drift apart.
 */

const MODEL_LABELS: Record<string, string> = {
  Lpo: 'LPO',
  PayrollPeriod: 'Payroll period',
  EquipmentTimesheet: 'Equipment timesheet',
  OperatorTimesheet: 'Operator timesheet',
  LeaveRequest: 'Leave request',
  PublicHoliday: 'Public holiday',
  RamadanPeriod: 'Ramadan period',
}

/** "PayrollPeriod" → "Payroll period", falling back to splitting camelCase
 * for any model name that doesn't need a special-cased label — never leak
 * the raw Prisma name into the UI. */
export function humanizeModelName(entityType: string): string {
  return MODEL_LABELS[entityType] ?? entityType.replace(/([a-z])([A-Z])/g, '$1 $2')
}

/** Where a record's own detail page lives, keyed by entityType. Omitted
 * entirely for models with no standalone page (Document, PublicHoliday,
 * RamadanPeriod live inside their owner's page) — those render as plain
 * text in the audit log, same treatment a deleted record gets. */
const RECORD_HREF: Record<string, (id: string) => string> = {
  Contract: (id) => `/contracts/${id}`,
  Customer: (id) => `/customers/${id}`,
  Equipment: (id) => `/equipment/${id}`,
  Employee: (id) => `/operators/${id}`,
  Lpo: (id) => `/lpos/${id}`,
  Invoice: (id) => `/invoices/${id}`,
  LeaveRequest: (id) => `/leave/${id}`,
  PayrollPeriod: (id) => `/payroll/${id}`,
  Payslip: (id) => `/payroll/payslip/${id}`,
  EquipmentTimesheet: (id) => `/timesheets/equipment/${id}`,
  OperatorTimesheet: (id) => `/timesheets/operator/${id}`,
  User: (id) => `/admin/users/${id}/edit`,
}

/** Null when the record was deleted (nothing to link to — a deleted
 * record's name is always plain text) or when its model has no
 * standalone detail page. */
export function recordHref(entityType: string, entityId: string, action: string): string | null {
  if (action === 'DELETE') return null
  return RECORD_HREF[entityType]?.(entityId) ?? null
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Changed',
  DELETE: 'Deleted',
}

export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const
