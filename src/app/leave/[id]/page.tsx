import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/dates'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, type LeaveStatus, type LeaveType } from '@/lib/enums'
import { leaveDaysConsumed } from '@/lib/leave'
import { loadLeaveRequest, loadPublicHolidays } from '@/lib/leave-queries'
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  rejectLeaveRequest,
} from '@/lib/actions/leave'
import { DecisionForm } from '@/components/leave/DecisionForm'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function LeaveRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [request, publicHolidays] = await Promise.all([
    loadLeaveRequest(id),
    loadPublicHolidays(),
  ])

  if (!request) notFound()

  const days = leaveDaysConsumed(
    request.leaveType as LeaveType,
    request.startDate,
    request.endDate,
    publicHolidays,
  )

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leave" className="text-sm text-slate-500 hover:text-slate-900">
          ← Leave
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {request.employee.name}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                {LEAVE_STATUS_LABELS[request.status as LeaveStatus] ?? request.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {LEAVE_TYPE_LABELS[request.leaveType as LeaveType] ?? request.leaveType}
              {' · '}
              {formatDate(request.startDate)} – {formatDate(request.endDate)} ({days} day
              {days === 1 ? '' : 's'})
            </p>
          </div>

          <Link href={`/operators/${request.employeeId}`} className={buttonSecondaryClass}>
            View employee
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Details</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Requested" value={formatDate(request.requestedDate)} />
          <Detail
            label="Pay treatment"
            value={
              request.leaveType === 'SICK'
                ? 'Tiered (statutory sick pay rule)'
                : request.paidOverride === null
                  ? 'Type default'
                  : request.paidOverride
                    ? 'Paid (override)'
                    : 'Unpaid (override)'
            }
          />
          <Detail label="Decided by" value={request.decidedBy} />
          <Detail
            label="Decided date"
            value={request.decidedDate ? formatDate(request.decidedDate) : null}
          />
          <div className="sm:col-span-2">
            <Detail label="Note" value={request.note} />
          </div>
        </dl>
      </section>

      {request.status === 'PENDING' && (
        <DecisionForm
          approveAction={approveLeaveRequest.bind(null, request.id)}
          rejectAction={rejectLeaveRequest.bind(null, request.id)}
        />
      )}

      {(request.status === 'PENDING' || request.status === 'APPROVED') && (
        <form action={cancelLeaveRequest.bind(null, request.id)}>
          <button type="submit" className="text-sm text-red-600 hover:underline">
            Cancel this request
          </button>
        </form>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value || '—'}</dd>
    </div>
  )
}
