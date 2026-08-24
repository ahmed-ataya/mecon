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
import { findDeletionRecord } from '@/lib/audit-queries'
import { DeletedRecordNotice } from '@/components/audit/DeletedRecordNotice'
import { RecordHistoryPanel } from '@/components/audit/RecordHistoryPanel'
import { PageHeader } from '@/components/shell/PageHeader'

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

  if (!request) {
    const deletion = await findDeletionRecord('LeaveRequest', id)
    if (deletion) {
      return (
        <DeletedRecordNotice entityTypeLabel="Leave request" entityLabel={deletion.entityLabel} />
      )
    }
    notFound()
  }

  const days = leaveDaysConsumed(
    request.leaveType as LeaveType,
    request.startDate,
    request.endDate,
    publicHolidays,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        crumb="Leave"
        crumbHref="/leave"
        title={request.employee.name}
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            {LEAVE_STATUS_LABELS[request.status as LeaveStatus] ?? request.status}
          </span>
        }
        description={`${LEAVE_TYPE_LABELS[request.leaveType as LeaveType] ?? request.leaveType} · ${formatDate(request.startDate)} – ${formatDate(request.endDate)} (${days} day${days === 1 ? '' : 's'})`}
        actions={
          <Link href={`/operators/${request.employeeId}`} className={buttonSecondaryClass}>
            View employee
          </Link>
        }
      />

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

      <RecordHistoryPanel entityType="LeaveRequest" entityId={request.id} />
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
