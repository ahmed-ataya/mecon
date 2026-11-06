import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewPayroll } from '@/lib/permissions'
import { loadPayrollPeriodForWps } from '@/lib/payroll-queries'
import { BANKS, type Bank } from '@/lib/enums'
import { generateSif, wpsBankReadiness, validateEmployeesForWps } from '@/lib/wps'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; bank: string }> },
) {
  const user = await getCurrentUser()
  if (!user || !canViewPayroll(user.role)) {
    return new NextResponse('Payroll is visible to Admin only.', { status: 403 })
  }

  const { id, bank: bankParam } = await params
  if (!BANKS.includes(bankParam as Bank)) {
    return new NextResponse('Unknown bank.', { status: 404 })
  }
  const bank = bankParam as Bank

  const readiness = wpsBankReadiness(bank)
  if (readiness === 'NO_LAYOUT') {
    return new NextResponse(`${bank}'s SIF field layout isn't configured yet.`, {
      status: 400,
    })
  }
  if (readiness === 'NEEDS_PAYER_DETAILS') {
    return new NextResponse(
      `${bank}'s file layout is built, but the company's own ${bank} establishment ` +
        `number and account IBAN haven't been entered yet — see WPS_PAYER_CONFIG ` +
        `in src/lib/wps.ts.`,
      { status: 400 },
    )
  }

  const period = await loadPayrollPeriodForWps(id)
  if (!period) return new NextResponse('Not found', { status: 404 })

  const payslips = period.payslips.filter((p) => p.employee.bankName === bank)

  if (payslips.length === 0) {
    return new NextResponse('No employees on this bank in this period.', {
      status: 400,
    })
  }

  const issues = validateEmployeesForWps(payslips.map((p) => p.employee))
  if (issues.length > 0) {
    return new NextResponse(
      `Blocked — fix these first:\n${issues
        .map((i) => `${i.employeeName}: ${i.issues.join('; ')}`)
        .join('\n')}`,
      { status: 400 },
    )
  }

  const { filename, content } = generateSif({
    bank,
    payslips,
    year: period.year,
    month: period.month,
    generatedAt: new Date(),
  })

  return new NextResponse(content, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}
