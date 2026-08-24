import Link from 'next/link'
import { monthLabel } from '@/lib/timesheet'
import {
  loadEquipmentTimesheets,
  loadOperatorTimesheets,
} from '@/lib/timesheet-queries'
import { buttonPrimaryClass } from '@/components/ui/form'
import { PageHeader } from '@/components/shell/PageHeader'

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
  SIGNED: 'bg-green-50 text-green-700 ring-green-200',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_CLASSES[status] ?? STATUS_CLASSES.DRAFT
      }`}
    >
      {status === 'SIGNED' ? 'Signed' : 'Draft'}
    </span>
  )
}

export default async function TimesheetsPage() {
  const [equipmentTimesheets, operatorTimesheets] = await Promise.all([
    loadEquipmentTimesheets(),
    loadOperatorTimesheets(),
  ])

  return (
    <div className="space-y-10">
      <PageHeader
        title="Timesheets"
        description="Equipment timesheets drive invoicing; operator timesheets drive payroll. Never derived from each other, even when the numbers match."
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Equipment</h2>
          <Link href="/timesheets/equipment/new" className={buttonPrimaryClass}>
            New equipment timesheet
          </Link>
        </div>

        {equipmentTimesheets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
            No equipment timesheets yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Machine</th>
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipmentTimesheets.map((timesheet) => (
                  <tr key={timesheet.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/timesheets/equipment/${timesheet.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {timesheet.referenceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {timesheet.equipmentAssignment.equipment.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {timesheet.equipmentAssignment.contract.customer.name}
                      {' · '}
                      {timesheet.equipmentAssignment.contract.projectName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {monthLabel(timesheet.year, timesheet.month)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={timesheet.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Operator</h2>
          <Link href="/timesheets/operator/new" className={buttonPrimaryClass}>
            New operator timesheet
          </Link>
        </div>

        {operatorTimesheets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
            No operator timesheets yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Operator</th>
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operatorTimesheets.map((timesheet) => (
                  <tr key={timesheet.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/timesheets/operator/${timesheet.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {timesheet.referenceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {timesheet.operatorAssignment.operator?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {timesheet.operatorAssignment.contract.customer.name}
                      {' · '}
                      {timesheet.operatorAssignment.contract.projectName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {monthLabel(timesheet.year, timesheet.month)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={timesheet.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
