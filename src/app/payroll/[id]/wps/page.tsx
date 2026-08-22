import Link from 'next/link'
import { notFound } from 'next/navigation'
import { monthLabel } from '@/lib/timesheet'
import { loadPayrollPeriodForWps } from '@/lib/payroll-queries'
import { requirePayrollPage } from '@/lib/auth/guard'
import { BANKS, BANK_LABELS, type Bank } from '@/lib/enums'
import { isWpsBankConfigured, validateEmployeesForWps } from '@/lib/wps'
import { buttonPrimaryClass } from '@/components/ui/form'

export default async function WpsExportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePayrollPage()
  const { id } = await params
  const period = await loadPayrollPeriodForWps(id)

  if (!period) notFound()

  const unassigned = period.payslips.filter(
    (p) => !p.employee.bankName || !BANKS.includes(p.employee.bankName as Bank),
  )

  const byBank = BANKS.map((bank) => {
    const payslips = period.payslips.filter((p) => p.employee.bankName === bank)
    const issues = validateEmployeesForWps(payslips.map((p) => p.employee))
    return { bank, payslips, issues }
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/payroll/${id}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← {monthLabel(period.year, period.month)}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          WPS export
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          One SIF file per bank — each employee is paid through the bank on
          their own record. Admin only.
        </p>
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          <p className="font-medium">
            {unassigned.length} employee{unassigned.length === 1 ? '' : 's'} with no
            bank assigned — not in either file below.
          </p>
          <ul className="mt-1 list-inside list-disc">
            {unassigned.map((p) => (
              <li key={p.id}>
                <Link href={`/operators/${p.employeeId}`} className="hover:underline">
                  {p.employee.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {byBank.map(({ bank, payslips, issues }) => (
        <section
          key={bank}
          className="rounded-lg border border-slate-200 bg-white p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">{BANK_LABELS[bank]}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {payslips.length} employee{payslips.length === 1 ? '' : 's'}
              </p>
            </div>

            {isWpsBankConfigured(bank) ? (
              payslips.length > 0 && issues.length === 0 ? (
                <a
                  href={`/payroll/${id}/wps/${bank}`}
                  className={buttonPrimaryClass}
                >
                  Download SIF
                </a>
              ) : payslips.length > 0 ? (
                <span className="text-sm text-red-600">
                  Blocked — fix the issues below
                </span>
              ) : null
            ) : (
              <span className="text-sm text-slate-400">
                Field layout not yet configured
              </span>
            )}
          </div>

          {issues.length > 0 && (
            <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              <p className="font-medium">
                {issues.length} employee{issues.length === 1 ? '' : 's'} can&rsquo;t be
                included yet:
              </p>
              <ul className="mt-2 space-y-1">
                {issues.map((issue) => (
                  <li key={issue.employeeId}>
                    <Link
                      href={`/operators/${issue.employeeId}`}
                      className="font-medium hover:underline"
                    >
                      {issue.employeeName}
                    </Link>
                    {' — '}
                    {issue.issues.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
