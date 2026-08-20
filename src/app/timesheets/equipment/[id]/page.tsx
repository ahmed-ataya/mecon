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

export default async function EquipmentTimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const timesheet = await loadEquipmentTimesheet(id)

  if (!timesheet) notFound()

  const { equipment, contract } = timesheet.equipmentAssignment
  const isSigned = timesheet.status === 'SIGNED'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/timesheets"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Timesheets
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {timesheet.referenceNumber}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  isSigned
                    ? 'bg-green-50 text-green-700 ring-green-200'
                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                }`}
              >
                {isSigned ? 'Signed' : 'Draft'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {equipment.name} · {contract.customer.name} ·{' '}
              {contract.projectName} · {monthLabel(timesheet.year, timesheet.month)}
            </p>
          </div>

          <div className="flex gap-3">
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
          </div>
        </div>

        {isSigned && timesheet.signedDate && (
          <p className="mt-2 text-xs text-slate-500">
            Signed {toDateInputValue(timesheet.signedDate)}. Unsign to make
            changes.
          </p>
        )}
      </div>

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
    </div>
  )
}
