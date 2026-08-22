import { db } from './db'
import { formatDate } from './dates'
import { formatQar } from './money'
import type { CurrentUser } from './auth/session'

/**
 * One row per create/update/delete — see AuditLog's model comment in
 * schema.prisma for why userName/entityLabel/changedFields are snapshots,
 * human-formatted at write time rather than derived on read. Every
 * mutating Server Action calls this after its write succeeds, right after
 * the requireWrite()/requireDelete() guard that already resolved `user`,
 * passing a `changedFields` array built with diffField/createdField below.
 */

export type FieldChange = { field: string; was: string | null; now: string | null }

const MAX_FIELD_LENGTH = 200

function truncate(value: string | null): string | null {
  if (value === null) return null
  return value.length > MAX_FIELD_LENGTH ? value.slice(0, MAX_FIELD_LENGTH - 1) + '…' : value
}

/**
 * One row for an UPDATE diff — only returned when the two values actually
 * differ, so a caller can build a list with `.filter(Boolean)` and never
 * show a field that didn't change. Comparison happens on the FORMATTED
 * string, not the raw value, so e.g. two Date objects for the same day
 * never falsely show as a change.
 */
export function diffField<T>(
  label: string,
  before: T | null | undefined,
  after: T | null | undefined,
  format: (value: T) => string = String,
): FieldChange | null {
  const wasStr = before === null || before === undefined ? null : format(before)
  const nowStr = after === null || after === undefined ? null : format(after)
  if (wasStr === nowStr) return null
  return { field: label, was: truncate(wasStr), now: truncate(nowStr) }
}

/**
 * A field on a newly CREATED record — always included, no before/after
 * comparison. `was` stays null, matching how the field-detail table
 * renders a Created entry (a "Value" column, not a "Was/Now" pair).
 */
export function createdField<T>(
  label: string,
  value: T | null | undefined,
  format: (value: T) => string = String,
): FieldChange {
  return {
    field: label,
    was: null,
    now: value === null || value === undefined ? null : truncate(format(value)),
  }
}

/**
 * A field's value at the moment a record was DELETED — same shape as
 * createdField (was: null, now: the value), just rendered under a
 * "Value at deletion" heading instead of "Value" so the record could be
 * recreated by hand from the log alone.
 */
export const deletedField = createdField

/** Shared formatters for the common field types — money is stored in
 * integer halalas everywhere in this app (see src/lib/money.ts), dates as
 * UTC-midnight Date objects (see src/lib/dates.ts). */
export const fmt = {
  money: (halalas: number) => formatQar(halalas),
  date: (value: Date) => formatDate(value),
  bool: (value: boolean) => (value ? 'Yes' : 'No'),
  text: (value: unknown) => String(value),
}

export async function logAudit({
  user,
  action,
  entityType,
  entityId,
  entityLabel,
  changedFields,
}: {
  user: CurrentUser
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  entityType: string
  entityId: string
  entityLabel?: string | null
  /** Omit for an action with nothing meaningful to show (e.g. a re-pull
   * that didn't change anything) — the detail view falls back to "No
   * field detail recorded for this entry." Pass `[]` deliberately for "we
   * checked, genuinely nothing changed," distinct from omitting it. */
  changedFields?: FieldChange[]
}): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: user.id,
      userName: user.name,
      action,
      entityType,
      entityId,
      entityLabel: entityLabel ?? null,
      changedFields: changedFields ?? undefined,
    },
  })
}
