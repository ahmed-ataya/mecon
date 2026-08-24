import Link from 'next/link'
import { notFound } from 'next/navigation'
import { toDateInputValue } from '@/lib/dates'
import { monthLabel } from '@/lib/timesheet'
import type { LeaveType, TimesheetDayType } from '@/lib/enums'
import { loadOperatorTimesheet } from '@/lib/timesheet-queries'
import {
  signOperatorTimesheet,
  unsignOperatorTimesheet,
  updateOperatorTimesheetDays,
} from '@/lib/actions/timesheets'
import { DailyRowsTable } from '@/components/timesheets/DailyRowsTable'
import { SignButton } from '@/components/timesheets/SignButton'
import { buttonSecondaryClass } from '@/components/ui/form'
import { findDeletionRecord } from '@/lib/audit-queries'
import { DeletedRecordNotice } from '@/components/audit/DeletedRecordNotice'
import { RecordHistoryPanel } from '@/components/audit/RecordHistoryPanel'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function OperatorTimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const timesheet = await loadOperatorTimesheet(id)

  if (!timesheet) {
    const deletion = await findDeletionRecord('OperatorTimesheet', id)
    if (deletion) {
      return (
        <DeletedRecordNotice
          entityTypeLabel="Operator timesheet"
          entityLabel={deletion.entityLabel}
        />
      )
    }
    notFound()
  }

  const { operator, contract } = timesheet.operatorAssignment
  const isSigned = timesheet.status === 'SIGNED'

  return (
    <div className="space-y-6">
      <PageHeader
        crumb="Timesheets"
        crumbHref="/timesheets"
        title={timesheet.referenceNumber}
        badge={
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
              isSigned
                ? 'bg-green-50 text-green-700 ring-green-200'
                : 'bg-slate-100 text-slate-600 ring-slate-200'
            }`}
          >
            {isSigned ? 'Signed' : 'Draft'}
          </span>
        }
        description={`${operator?.name ?? '—'} · ${contract.customer.name} · ${contract.projectName} · ${monthLabel(timesheet.year, timesheet.month)}`}
        actions={
          <>
            <Link
              href={`/timesheets/operator/${timesheet.id}/print`}
              className={buttonSecondaryClass}
            >
              Print
            </Link>
            <Link
              href={`/timesheets/operator/${timesheet.id}/export`}
              className={buttonSecondaryClass}
            >
              Export CSV
            </Link>
            <SignButton
              signed={isSigned}
              signAction={signOperatorTimesheet.bind(null, timesheet.id)}
              unsignAction={unsignOperatorTimesheet.bind(null, timesheet.id)}
            />
          </>
        }
      />

      {isSigned && timesheet.signedDate && (
        <p className="text-xs text-slate-500">
          Signed {toDateInputValue(timesheet.signedDate)}. Unsign to make
          changes.
        </p>
      )}

      <DailyRowsTable
        days={timesheet.days.map((day) => ({
          id: day.id,
          date: toDateInputValue(day.date),
          startTime: day.startTime,
          endTime: day.endTime,
          workingHours: day.workingHours,
          breakdownHours: day.breakdownHours,
          remarks: day.remarks,
          dayType: day.dayType as TimesheetDayType,
          leaveType: day.leaveType as LeaveType | null,
        }))}
        action={updateOperatorTimesheetDays.bind(null, timesheet.id)}
        showOvertimeSplit={true}
        readOnly={isSigned}
      />

      <RecordHistoryPanel entityType="OperatorTimesheet" entityId={timesheet.id} />
    </div>
  )
}
