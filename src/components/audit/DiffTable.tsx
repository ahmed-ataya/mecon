import type { FieldChange } from '@/lib/audit'

/** Prisma types a Json column as `JsonValue` — narrow it back to what
 * logAudit actually ever writes there before rendering. Anything that
 * doesn't match (an old row from before this shape existed, or a null)
 * falls back to the "no detail recorded" message rather than crashing. */
function asFieldChanges(value: unknown): FieldChange[] | null {
  if (!Array.isArray(value)) return null
  const rows = value.filter(
    (row): row is FieldChange =>
      typeof row === 'object' &&
      row !== null &&
      'field' in row &&
      typeof (row as Record<string, unknown>).field === 'string',
  )
  return rows.length > 0 ? rows : null
}

/**
 * The field-by-field detail under an expanded audit row, and the same
 * table reused on a record's own "Change history" panel — one renderer,
 * so the two views can never drift apart. Column layout matches the
 * action: Changed gets Field/Was/Now, Created and Deleted both get a
 * single Field/Value pair (Deleted just heads it differently) — see
 * AuditLog's schema comment for why `was`/`now` are shaped this way.
 */
export function DiffTable({
  action,
  changedFields,
}: {
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  changedFields: unknown
}) {
  const rows = asFieldChanges(changedFields)

  if (!rows) {
    return (
      <p className="px-3 py-3 text-sm text-slate-400">
        No field detail recorded for this entry.
      </p>
    )
  }

  const isUpdate = action === 'UPDATE'
  const valueHeader = action === 'DELETE' ? 'Value at deletion' : 'Value'

  return (
    <div className="max-w-[720px] overflow-hidden rounded-lg border border-slate-200">
      <div
        className={`grid gap-3.5 border-b border-slate-200 bg-[#f6f6f4] px-3 py-1.5 font-mono text-[9.5px] tracking-[0.09em] text-slate-400 uppercase ${
          isUpdate ? 'grid-cols-[150px_1fr_1fr]' : 'grid-cols-[150px_1fr]'
        }`}
      >
        <span>Field</span>
        {isUpdate ? (
          <>
            <span>Was</span>
            <span>Now</span>
          </>
        ) : (
          <span>{valueHeader}</span>
        )}
      </div>
      {rows.map((row, i) => (
        <div
          key={`${row.field}-${i}`}
          className={`grid items-baseline gap-3.5 px-3 py-1.5 text-sm ${
            isUpdate ? 'grid-cols-[150px_1fr_1fr]' : 'grid-cols-[150px_1fr]'
          } ${i < rows.length - 1 ? 'border-b border-slate-100' : ''}`}
        >
          <span className="text-slate-700">{row.field}</span>
          {isUpdate ? (
            <>
              <span className="truncate font-mono text-slate-400 line-through">
                {row.was ?? '—'}
              </span>
              <span className="truncate font-mono font-medium text-slate-900">
                {row.now ?? '—'}
              </span>
            </>
          ) : (
            <span className="truncate font-mono font-medium text-slate-900">
              {row.now ?? '—'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
