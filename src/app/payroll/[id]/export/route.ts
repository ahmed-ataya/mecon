import { NextResponse } from 'next/server'
import { monthLabel } from '@/lib/timesheet'
import { toCsv } from '@/lib/csv'
import { formatAmountExact } from '@/lib/money'
import { loadPayrollPeriod } from '@/lib/payroll-queries'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewPayroll } from '@/lib/permissions'

/** Payroll register for accounts — every payslip in the period, one row
 * each. Not the WPS/SIF bank file (deferred, see ROADMAP.md Phase E3) —
 * this is a plain internal record, riyals as decimals rather than halalas
 * so it opens ready to read in Excel. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || !canViewPayroll(user.role)) {
    return new NextResponse('Payroll is visible to Admin only.', { status: 403 })
  }

  const { id } = await params
  const period = await loadPayrollPeriod(id)

  if (!period) {
    return new NextResponse('Not found', { status: 404 })
  }

  const rows: (string | number)[][] = [
    ['Payroll Register', monthLabel(period.year, period.month)],
    ['Status', period.status],
    [],
    [
      'Reference',
      'Employee',
      'Employee No.',
      'Hours source',
      'Regular hrs',
      'Overtime hrs',
      'Basic salary',
      'Housing',
      'Transport',
      'Food',
      'Site',
      'Other',
      'Gross pay',
      'Deductions',
      'Net pay',
      'Bank',
      'IBAN / wage card',
    ],
    ...period.payslips.map((payslip) => [
      payslip.referenceNumber,
      payslip.employee.name,
      payslip.employee.employeeNumber ?? '',
      payslip.hoursSource,
      payslip.regularHours,
      payslip.overtimeHours,
      formatAmountExact(payslip.basicSalary),
      formatAmountExact(payslip.housingAllowance),
      formatAmountExact(payslip.transportAllowance),
      formatAmountExact(payslip.foodAllowance),
      formatAmountExact(payslip.siteAllowance),
      formatAmountExact(payslip.otherAllowance),
      formatAmountExact(payslip.grossPay),
      formatAmountExact(payslip.deductionsAmount),
      formatAmountExact(payslip.netPay),
      payslip.employee.bankName ?? '',
      payslip.employee.bankAccountNumber ?? '',
    ]),
    [
      'Total',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      formatAmountExact(period.payslips.reduce((sum, p) => sum + p.grossPay, 0)),
      formatAmountExact(
        period.payslips.reduce((sum, p) => sum + p.deductionsAmount, 0),
      ),
      formatAmountExact(period.payslips.reduce((sum, p) => sum + p.netPay, 0)),
      '',
      '',
    ],
  ]

  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="payroll-${period.year}-${String(period.month).padStart(2, '0')}.csv"`,
    },
  })
}
