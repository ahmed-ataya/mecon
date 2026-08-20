import { NextResponse } from 'next/server'
import { formatDate } from '@/lib/dates'
import { toCsv } from '@/lib/csv'
import { splitOvertimeHours } from '@/lib/overtime'
import { loadOperatorTimesheet } from '@/lib/timesheet-queries'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const timesheet = await loadOperatorTimesheet(id)

  if (!timesheet) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { operator, contract } = timesheet.operatorAssignment

  const rows: (string | number)[][] = [
    ['Operator Timesheet', timesheet.referenceNumber],
    ['Operator', operator?.name ?? ''],
    ['Customer', contract.customer.name],
    ['Project', contract.projectName],
    ['Site', contract.siteName],
    ['Status', timesheet.status],
    [],
    [
      'Date',
      'Start',
      'Finish',
      'Working hrs',
      'Breakdown hrs',
      'Regular',
      'Overtime',
      'Remarks',
    ],
    ...timesheet.days.map((day) => {
      const split = splitOvertimeHours(day.workingHours)
      return [
        formatDate(day.date),
        day.startTime ?? '',
        day.endTime ?? '',
        day.workingHours,
        day.breakdownHours,
        split.regularHours,
        split.overtimeHours,
        day.remarks ?? '',
      ]
    }),
    [
      'Total',
      '',
      '',
      timesheet.days.reduce((sum, d) => sum + d.workingHours, 0),
      timesheet.days.reduce((sum, d) => sum + d.breakdownHours, 0),
      timesheet.days.reduce(
        (sum, d) => sum + splitOvertimeHours(d.workingHours).regularHours,
        0,
      ),
      timesheet.days.reduce(
        (sum, d) => sum + splitOvertimeHours(d.workingHours).overtimeHours,
        0,
      ),
      '',
    ],
  ]

  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${timesheet.referenceNumber}.csv"`,
    },
  })
}
