import Link from 'next/link'
import { monthLabel } from '@/lib/timesheet'
import { formatQar } from '@/lib/money'
import { loadPayrollPeriods } from '@/lib/payroll-queries'
import { buttonPrimaryClass } from '@/components/ui/form'
import { requirePayrollPage } from '@/lib/auth/guard'

export default async function PayrollPage() {
  await requirePayrollPage()
  const periods = await loadPayrollPeriods()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">
            One period per month, covering every employee with a basic
            salary on file.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/payroll/ramadan"
            className="self-center text-sm text-slate-500 hover:text-slate-900 hover:underline"
          >
            Ramadan periods
          </Link>
          <Link href="/payroll/new" className={buttonPrimaryClass}>
            New payroll period
          </Link>
        </div>
      </div>

      {periods.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          No payroll periods yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Employees</th>
                <th className="px-4 py-3 font-medium">Total net pay</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((period) => {
                const totalNet = period.payslips.reduce(
                  (sum, p) => sum + p.netPay,
                  0,
                )
                return (
                  <tr key={period.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/payroll/${period.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {monthLabel(period.year, period.month)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {period.payslips.length}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatQar(totalNet)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          period.status === 'FINALIZED'
                            ? 'bg-green-50 text-green-700 ring-green-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200'
                        }`}
                      >
                        {period.status === 'FINALIZED' ? 'Finalized' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
