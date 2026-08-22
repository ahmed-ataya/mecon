import { requireAuditPage } from '@/lib/auth/guard'
import { db } from '@/lib/db'

const ACTION_CLASSES: Record<string, string> = {
  CREATE: 'bg-green-50 text-green-700 ring-green-200',
  UPDATE: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELETE: 'bg-red-50 text-red-700 ring-red-200',
}

/** Latest 200 entries — this is a record-of-record, not a paginated
 * archive browser. Revisit with real filters/pagination if the log grows
 * large enough that 200 stops being enough context. */
export default async function AuditLogPage() {
  await requireAuditPage()

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every create, edit and delete across the system. Admin only. Most
          recent {entries.length} entries.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {entry.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                </td>
                <td className="px-4 py-3 text-slate-900">{entry.userName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ACTION_CLASSES[entry.action] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}
                  >
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="font-medium text-slate-900">{entry.entityType}</span>
                  {entry.entityLabel && ` — ${entry.entityLabel}`}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Nothing logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
