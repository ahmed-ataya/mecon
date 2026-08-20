import Link from 'next/link'
import { notFound } from 'next/navigation'
import { monthLabel } from '@/lib/timesheet'
import { loadPayslip } from '@/lib/payroll-queries'
import { updatePayslip, regeneratePayslip } from '@/lib/actions/payroll'
import { PayslipEditForm } from '@/components/payroll/PayslipEditForm'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payslip = await loadPayslip(id)

  if (!payslip) notFound()

  const readOnly = payslip.payrollPeriod.status === 'FINALIZED'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/payroll/${payslip.payrollPeriodId}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← {monthLabel(payslip.payrollPeriod.year, payslip.payrollPeriod.month)}
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {payslip.employee.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {payslip.referenceNumber} ·{' '}
              {monthLabel(payslip.payrollPeriod.year, payslip.payrollPeriod.month)}
              {' · '}
              {payslip.hoursSource === 'TIMESHEET'
                ? 'Real hours from a signed timesheet'
                : 'Estimated standard hours'}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/payroll/payslip/${payslip.id}/print`}
              className={buttonSecondaryClass}
            >
              Print
            </Link>
            {!readOnly && payslip.hoursSource === 'TIMESHEET' && (
              <form action={regeneratePayslip.bind(null, payslip.id)}>
                <button type="submit" className={buttonSecondaryClass}>
                  Re-pull hours
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <PayslipEditForm
        payslip={payslip}
        action={updatePayslip.bind(null, payslip.id)}
        readOnly={readOnly}
      />
    </div>
  )
}
