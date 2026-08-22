import Link from 'next/link'
import { todayUtc } from '@/lib/dates'
import { createPayrollPeriod } from '@/lib/actions/payroll'
import { NewPayrollPeriodForm } from '@/components/payroll/NewPayrollPeriodForm'
import { requirePayrollPage } from '@/lib/auth/guard'

export default async function NewPayrollPeriodPage() {
  await requirePayrollPage()
  // Payroll is normally run for the month just ending — same "last calendar
  // month" default the invoice generator already uses.
  const today = todayUtc()
  const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/payroll"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Payroll
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New payroll period
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Generates one payslip per employee with a basic salary on file.
          Operators with a signed timesheet for this month are paid their
          actual hours; everyone else gets an editable estimate.
        </p>
      </div>

      <NewPayrollPeriodForm
        action={createPayrollPeriod}
        defaultYear={lastMonth.getUTCFullYear()}
        defaultMonth={lastMonth.getUTCMonth() + 1}
        cancelHref="/payroll"
      />
    </div>
  )
}
