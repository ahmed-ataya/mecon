import Link from 'next/link'
import { notFound } from 'next/navigation'
import { monthLabel } from '@/lib/timesheet'
import { loadPayslip } from '@/lib/payroll-queries'
import { updatePayslip, regeneratePayslip } from '@/lib/actions/payroll'
import { PayslipEditForm } from '@/components/payroll/PayslipEditForm'
import { buttonSecondaryClass } from '@/components/ui/form'
import { requirePayrollPage } from '@/lib/auth/guard'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePayrollPage()
  const { id } = await params
  const payslip = await loadPayslip(id)

  if (!payslip) notFound()

  const readOnly = payslip.payrollPeriod.status === 'FINALIZED'

  return (
    <div className="space-y-6">
      <PageHeader
        crumb={monthLabel(payslip.payrollPeriod.year, payslip.payrollPeriod.month)}
        crumbHref={`/payroll/${payslip.payrollPeriodId}`}
        title={payslip.employee.name}
        description={`${payslip.referenceNumber} · ${monthLabel(payslip.payrollPeriod.year, payslip.payrollPeriod.month)} · ${
          payslip.hoursSource === 'TIMESHEET'
            ? 'Real hours from a signed timesheet'
            : 'Estimated standard hours'
        }`}
        actions={
          <>
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
          </>
        }
      />

      <PayslipEditForm
        payslip={payslip}
        action={updatePayslip.bind(null, payslip.id)}
        readOnly={readOnly}
      />
    </div>
  )
}
