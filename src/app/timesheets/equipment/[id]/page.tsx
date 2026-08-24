import Link from 'next/link'
import { notFound } from 'next/navigation'
import { toDateInputValue } from '@/lib/dates'
import { monthLabel } from '@/lib/timesheet'
import { loadEquipmentTimesheet } from '@/lib/timesheet-queries'
import {
  signEquipmentTimesheet,
  unsignEquipmentTimesheet,
  updateEquipmentTimesheetDays,
} from '@/lib/actions/timesheets'
import { DailyRowsTable } from '@/components/timesheets/DailyRowsTable'
import { SignButton } from '@/components/timesheets/SignButton'
import { buttonSecondaryClass } from '@/components/ui/form'
import { findDeletionRecord } from '@/lib/audit-queries'
import { DeletedRecordNotice } from '@/components/audit/DeletedRecordNotice'
import { RecordHistoryPanel } from '@/components/audit/RecordHistoryPanel'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function EquipmentTimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const timesheet = await loadEquipmentTimesheet(id)

  if (!timesheet) {
    const deletion = await findDeletionRecord('EquipmentTimesheet', id)
    if (deletion) {
      return (
        <DeletedRecordNotice
          entityTypeLabel="Equipment timesheet"
          entityLabel={deletion.entityLabel}
        />
      )
    }
    notFound()
  }

  const { equipment, contract } = timesheet.equipmentAssignment
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
        description={`${equipment.name} · ${contract.customer.name} · ${contract.projectName} · ${monthLabel(timesheet.year, timesheet.month)}`}
        actions={
          <>
            <Link
              href={`/timesheets/equipment/${timesheet.id}/print`}
              className={buttonSecondaryClass}
            >
              Print
            </Link>
            <Link
              href={`/timesheets/equipment/${timesheet.id}/export`}
              className={buttonSecondaryClass}
            >
              Export CSV
            </Link>
            <SignButton
              signed={isSigned}
              signAction={signEquipmentTimesheet.bind(null, timesheet.id)}
              unsignAction={unsignEquipmentTimesheet.bind(null, timesheet.id)}
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
        }))}
        action={updateEquipmentTimesheetDays.bind(null, timesheet.id)}
        showOvertimeSplit={false}
        readOnly={isSigned}
      />

      <RecordHistoryPanel entityType="EquipmentTimesheet" entityId={timesheet.id} />
    </div>
  )
}
