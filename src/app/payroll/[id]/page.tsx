import Link from 'next/link'
import { notFound } from 'next/navigation'
import { toDateInputValue } from '@/lib/dates'
import { monthLabel } from '@/lib/timesheet'
import { formatQar } from '@/lib/money'
import { loadPayrollPeriod } from '@/lib/payroll-queries'
import {
  finalizePayrollPeriod,
  unfinalizePayrollPeriod,
} from '@/lib/actions/payroll'
import { FinalizeButton } from '@/components/payroll/FinalizeButton'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function PayrollPeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const period = await loadPayrollPeriod(id)

  if (!period) notFound()

  const isFinalized = period.status === 'FINALIZED'
  const totalNet = period.payslips.reduce((sum, p) => sum + p.netPay, 0)
  const totalGross = period.payslips.reduce((sum, p) => sum + p.grossPay, 0)
  const estimateCount = period.payslips.filter((p) => p.hoursSource === 'ESTIMATE').length

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/payroll"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Payroll
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {monthLabel(period.year, period.month)}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  isFinalized
                    ? 'bg-green-50 text-green-700 ring-green-200'
                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                }`}
              >
                {isFinalized ? 'Finalized' : 'Draft'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {period.payslips.length} payslip
              {period.payslips.length === 1 ? '' : 's'} · Gross{' '}
              {formatQar(totalGross)} · Net {formatQar(totalNet)}
            </p>
          </div>

          <div className="flex gap-3">
            <Link href={`/payroll/${period.id}/export`} className={buttonSecondaryClass}>
              Export register (CSV)
            </Link>
            <FinalizeButton
              finalized={isFinalized}
              finalizeAction={finalizePayrollPeriod.bind(null, period.id)}
              unfinalizeAction={unfinalizePayrollPeriod.bind(null, period.id)}
            />
          </div>
        </div>

        {isFinalized && period.finalizedDate && (
          <p className="mt-2 text-xs text-slate-500">
            Finalized {toDateInputValue(period.finalizedDate)}. Unfinalize to
            make changes.
          </p>
        )}

        {estimateCount > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
            {estimateCount} payslip{estimateCount === 1 ? '' : 's'} on an
            estimated standard month — no signed operator timesheet was
            found for that employee this period. Edit hours directly on a
            payslip, or sign the timesheet and reopen it to pull in real
            hours.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Hours source</th>
              <th className="px-4 py-3 font-medium">Regular</th>
              <th className="px-4 py-3 font-medium">OT</th>
              <th className="px-4 py-3 font-medium">Gross</th>
              <th className="px-4 py-3 font-medium">Deductions</th>
              <th className="px-4 py-3 font-medium">Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {period.payslips.map((payslip) => (
              <tr key={payslip.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/payroll/payslip/${payslip.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {payslip.employee.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {payslip.referenceNumber}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs ${
                      payslip.hoursSource === 'TIMESHEET'
                        ? 'text-green-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {payslip.hoursSource === 'TIMESHEET' ? 'Timesheet' : 'Estimated'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {payslip.regularHours}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {payslip.overtimeHours}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatQar(payslip.grossPay)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatQar(payslip.deductionsAmount)}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {formatQar(payslip.netPay)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
