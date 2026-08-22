import { notFound } from 'next/navigation'
import { monthLabel } from '@/lib/timesheet'
import { formatQar } from '@/lib/money'
import { computePayslip } from '@/lib/payroll'
import { loadPayslip } from '@/lib/payroll-queries'
import { COMPANY } from '@/lib/company'
import { PrintControls } from '@/components/invoices/PrintControls'
import { requirePayrollPage } from '@/lib/auth/guard'

export default async function PayslipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePayrollPage()
  const { id } = await params
  const payslip = await loadPayslip(id)

  if (!payslip) notFound()

  const calc = computePayslip(payslip)

  return (
    <>
      <PrintControls />

      <div className="invoice-sheet mx-auto max-w-[210mm] bg-white p-10 text-black">
        <header className="letterhead mb-8 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div className="text-sm font-semibold leading-tight">
            MEDITERRANEAN EQUIPMENT
            <br />
            AND CONTRACTING <span className="text-xs">W.L.L.</span>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tracking-wide">
              {COMPANY.shortName}
            </div>
          </div>
          <div dir="rtl" className="text-sm font-semibold leading-tight">
            {COMPANY.nameAr}
          </div>
        </header>

        <h1 className="mb-4 text-center text-lg font-bold underline">PAYSLIP</h1>

        <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div>
            <span className="font-semibold">Reference:</span>{' '}
            {payslip.referenceNumber}
          </div>
          <div>
            <span className="font-semibold">Period:</span>{' '}
            {monthLabel(payslip.payrollPeriod.year, payslip.payrollPeriod.month)}
          </div>
          <div>
            <span className="font-semibold">Employee:</span>{' '}
            {payslip.employee.name}
          </div>
          <div>
            <span className="font-semibold">Employee No.:</span>{' '}
            {payslip.employee.employeeNumber ?? '—'}
          </div>
          <div>
            <span className="font-semibold">Bank:</span>{' '}
            {payslip.employee.bankName ?? '—'}
          </div>
          <div>
            <span className="font-semibold">IBAN / wage card:</span>{' '}
            {payslip.employee.bankAccountNumber ?? '—'}
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-sm">
          <tbody>
            <tr>
              <td className="border border-black px-3 py-1.5 font-semibold">
                Basic salary
              </td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(payslip.basicSalary)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">
                Shortfall deduction ({calc.shortfallHours} hrs)
              </td>
              <td className="border border-black px-3 py-1.5 text-right">
                − {formatQar(calc.shortfallDeduction)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">
                Overtime pay ({payslip.overtimeHours} hrs @ 125%)
              </td>
              <td className="border border-black px-3 py-1.5 text-right">
                + {formatQar(calc.overtimePay)}
              </td>
            </tr>
            <tr className="font-semibold">
              <td className="border border-black px-3 py-1.5">Basic pay</td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(calc.basicPay)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">Housing allowance</td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(payslip.housingAllowance)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">Transport allowance</td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(payslip.transportAllowance)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">Food allowance</td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(payslip.foodAllowance)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">Site allowance</td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(payslip.siteAllowance)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">Other allowance</td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(payslip.otherAllowance)}
              </td>
            </tr>
            <tr className="font-semibold">
              <td className="border border-black px-3 py-1.5">Gross pay</td>
              <td className="border border-black px-3 py-1.5 text-right">
                {formatQar(calc.grossPay)}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-1.5">
                Deductions{payslip.deductionsNote ? ` (${payslip.deductionsNote})` : ''}
              </td>
              <td className="border border-black px-3 py-1.5 text-right">
                − {formatQar(payslip.deductionsAmount)}
              </td>
            </tr>
            <tr className="text-base font-bold">
              <td className="border border-black px-3 py-2">Net pay</td>
              <td className="border border-black px-3 py-2 text-right">
                {formatQar(calc.netPay)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-16 flex items-end justify-between text-sm font-bold">
          <div className="border-t border-black pt-1 pr-16">
            Employee&rsquo;s Signature
          </div>
          <div className="border-t border-black pl-16 pt-1">
            For {COMPANY.shortName}
          </div>
        </div>

        <footer className="letterhead mt-10 border-t border-black pt-2 text-center text-[10px] leading-snug">
          <div>
            Tel.: {COMPANY.tel} &nbsp; Fax: {COMPANY.fax} &nbsp; {COMPANY.poBox}
          </div>
          <div>
            Email: {COMPANY.email} &nbsp; Website: {COMPANY.website}
          </div>
        </footer>
      </div>
    </>
  )
}
