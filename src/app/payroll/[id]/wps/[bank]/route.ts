import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { canViewPayroll } from '@/lib/permissions'
import { loadPayrollPeriodForWps } from '@/lib/payroll-queries'
import { BANKS, type Bank } from '@/lib/enums'
import { generateCbqSif, isWpsBankConfigured, validateEmployeesForWps } from '@/lib/wps'

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

  if (!isWpsBankConfigured(bank)) {
    return new NextResponse(`${bank}'s SIF field layout isn't configured yet.`, {
      status: 400,
    })
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

  // Only CBQ is wired up below (generateCbqSif) — the `if` guards against a
  // second bank being added to BANKS before its own generator exists.
  if (bank !== 'CBQ') {
    return new NextResponse(`${bank}'s export isn't built yet.`, { status: 501 })
  }

  const { filename, content } = generateCbqSif({
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
