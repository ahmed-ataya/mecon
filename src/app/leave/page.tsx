import Link from 'next/link'
import { formatDate } from '@/lib/dates'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, type LeaveStatus, type LeaveType } from '@/lib/enums'
import { loadLeaveRequests } from '@/lib/leave-queries'
import { buttonPrimaryClass, buttonSecondaryClass } from '@/components/ui/form'

const STATUS_CLASSES: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  APPROVED: 'bg-green-50 text-green-700 ring-green-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  CANCELLED: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export default async function LeavePage() {
  const requests = await loadLeaveRequests()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>
          <p className="mt-1 text-sm text-slate-500">
            {requests.length} request{requests.length === 1 ? '' : 's'} on
            record.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/leave/calendar" className={buttonSecondaryClass}>
            Calendar
          </Link>
          <Link href="/leave/holidays" className={buttonSecondaryClass}>
            Public holidays
          </Link>
          <Link href="/leave/new" className={buttonPrimaryClass}>
            Request leave
          </Link>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-500">No leave requests yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/leave/${r.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {r.employee.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {LEAVE_TYPE_LABELS[r.leaveType as LeaveType] ?? r.leaveType}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(r.startDate)} – {formatDate(r.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLASSES[r.status as LeaveStatus]}`}
                    >
                      {LEAVE_STATUS_LABELS[r.status as LeaveStatus] ?? r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
