import { notFound } from 'next/navigation'
import { formatDate, toDateInputValue } from '@/lib/dates'
import { monthLabel } from '@/lib/timesheet'
import { splitOvertimeHours } from '@/lib/overtime'
import { loadOperatorTimesheet } from '@/lib/timesheet-queries'
import { COMPANY } from '@/lib/company'
import { PrintControls } from '@/components/invoices/PrintControls'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function dayName(dateString: string) {
  return DAY_NAMES[new Date(`${dateString}T00:00:00Z`).getUTCDay()]
}

/** Printed operator timesheet. Regular/overtime columns are the one real
 * difference from the equipment version — see overtime.ts for the rule. */
export default async function OperatorTimesheetPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const timesheet = await loadOperatorTimesheet(id)

  if (!timesheet) notFound()

  const { operator, contract } = timesheet.operatorAssignment
  const totalWorking = timesheet.days.reduce((sum, d) => sum + d.workingHours, 0)
  const totalBreakdown = timesheet.days.reduce((sum, d) => sum + d.breakdownHours, 0)
  const totalRegular = timesheet.days.reduce(
    (sum, d) => sum + splitOvertimeHours(d.workingHours).regularHours,
    0,
  )
  const totalOvertime = timesheet.days.reduce(
    (sum, d) => sum + splitOvertimeHours(d.workingHours).overtimeHours,
    0,
  )

  return (
    <>
      <PrintControls />

      <div className="invoice-sheet mx-auto max-w-[297mm] bg-white p-10 text-black">
        <header className="letterhead mb-6 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div className="text-sm font-semibold leading-tight">
            MEDITERRANEAN EQUIPMENT
            <br />
            AND CONTRACTING <span className="text-xs">W.L.L.</span>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tracking-wide">
              {COMPANY.shortName}
            </div>
          </div>
          <div dir="rtl" className="text-sm font-semibold leading-tight">
            {COMPANY.nameAr}
          </div>
        </header>

        <h1 className="mb-4 text-center text-lg font-bold underline">
          OPERATOR TIMESHEET
        </h1>

        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div>
            <span className="font-semibold">Reference:</span>{' '}
            {timesheet.referenceNumber}
          </div>
          <div>
            <span className="font-semibold">Period:</span>{' '}
            {monthLabel(timesheet.year, timesheet.month)}
          </div>
          <div>
            <span className="font-semibold">Operator:</span>{' '}
            {operator?.name ?? '—'}
          </div>
          <div>
            <span className="font-semibold">Customer:</span>{' '}
            {contract.customer.name}
          </div>
          <div className="col-span-2">
            <span className="font-semibold">Project / Site:</span>{' '}
            {contract.projectName} — {contract.siteName}
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr>
              <th className="border border-black px-1 py-1">Date</th>
              <th className="border border-black px-1 py-1">Day</th>
              <th className="border border-black px-1 py-1">Start</th>
              <th className="border border-black px-1 py-1">Finish</th>
              <th className="border border-black px-1 py-1">Working hrs</th>
              <th className="border border-black px-1 py-1">Breakdown hrs</th>
              <th className="border border-black px-1 py-1">Regular</th>
              <th className="border border-black px-1 py-1">OT</th>
              <th className="border border-black px-1 py-1">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {timesheet.days.map((day) => {
              const dateString = toDateInputValue(day.date)
              const split = splitOvertimeHours(day.workingHours)
              return (
                <tr key={day.id}>
                  <td className="border border-black px-1 py-1 text-center">
                    {formatDate(day.date)}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">
                    {dayName(dateString)}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">
                    {day.startTime ?? ''}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">
                    {day.endTime ?? ''}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">
                    {day.workingHours}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">
                    {day.breakdownHours}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">
                    {split.regularHours}
                  </td>
                  <td className="border border-black px-1 py-1 text-center">
                    {split.overtimeHours}
                  </td>
                  <td className="border border-black px-1 py-1">
                    {day.remarks}
                  </td>
                </tr>
              )
            })}
            <tr className="font-bold">
              <td className="border border-black px-1 py-1 text-right" colSpan={4}>
                Total
              </td>
              <td className="border border-black px-1 py-1 text-center">
                {totalWorking}
              </td>
              <td className="border border-black px-1 py-1 text-center">
                {totalBreakdown}
              </td>
              <td className="border border-black px-1 py-1 text-center">
                {totalRegular}
              </td>
              <td className="border border-black px-1 py-1 text-center">
                {totalOvertime}
              </td>
              <td className="border border-black px-1 py-1" />
            </tr>
          </tbody>
        </table>

        <div className="mt-16 grid grid-cols-3 gap-8 text-sm font-bold">
          <div className="border-t border-black pt-1">Operator</div>
          <div className="border-t border-black pt-1">
            Client Site Representative
          </div>
          <div className="border-t border-black pt-1">
            For {COMPANY.shortName}
          </div>
        </div>
        <div className="mt-2 text-xs text-black">
          Date signed:{' '}
          {timesheet.signedDate ? formatDate(timesheet.signedDate) : '________________'}
        </div>

        <footer className="letterhead mt-10 border-t border-black pt-2 text-center text-[10px] leading-snug">
          <div>
            Tel.: {COMPANY.tel} &nbsp; Fax: {COMPANY.fax} &nbsp; {COMPANY.poBox}
          </div>
          <div>
            Email: {COMPANY.email} &nbsp; Website: {COMPANY.website}
          </div>
        </footer>
      </div>
    </>
  )
}
