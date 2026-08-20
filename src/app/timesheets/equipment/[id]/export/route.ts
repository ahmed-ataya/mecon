import { NextResponse } from 'next/server'
import { formatDate } from '@/lib/dates'
import { toCsv } from '@/lib/csv'
import { loadEquipmentTimesheet } from '@/lib/timesheet-queries'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const timesheet = await loadEquipmentTimesheet(id)

  if (!timesheet) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { equipment, contract } = timesheet.equipmentAssignment

  const rows: (string | number)[][] = [
    ['Equipment Timesheet', timesheet.referenceNumber],
    ['Equipment', equipment.name],
    ['Customer', contract.customer.name],
    ['Project', contract.projectName],
    ['Site', contract.siteName],
    ['Status', timesheet.status],
    [],
    ['Date', 'Start', 'Finish', 'Working hrs', 'Breakdown hrs', 'Remarks'],
    ...timesheet.days.map((day) => [
      formatDate(day.date),
      day.startTime ?? '',
      day.endTime ?? '',
      day.workingHours,
      day.breakdownHours,
      day.remarks ?? '',
    ]),
    [
      'Total',
      '',
      '',
      timesheet.days.reduce((sum, d) => sum + d.workingHours, 0),
      timesheet.days.reduce((sum, d) => sum + d.breakdownHours, 0),
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
