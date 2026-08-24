import { formatDate } from '@/lib/dates'
import { loadRamadanPeriods } from '@/lib/payroll-queries'
import { deleteRamadanPeriod } from '@/lib/actions/ramadan'
import { RamadanPeriodForm } from '@/components/payroll/RamadanPeriodForm'
import { requirePayrollPage } from '@/lib/auth/guard'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function RamadanPeriodsPage() {
  await requirePayrollPage()
  const periods = await loadRamadanPeriods()

  return (
    <div className="space-y-6">
      <PageHeader
        crumb="Payroll"
        crumbHref="/payroll"
        title="Ramadan periods"
        description="Standard hours drop to 6/day, 36/week for any payroll day falling inside one of these — no pay reduction. Dates are moon-sighting based, so they’re entered here rather than guessed at in code."
      />

      <RamadanPeriodForm />

      {periods.length === 0 ? (
        <p className="text-sm text-slate-500">No Ramadan periods recorded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full max-w-md text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((period) => (
                <tr key={period.id}>
                  <td className="px-4 py-3 text-slate-900">{period.year}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(period.startDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(period.endDate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteRamadanPeriod.bind(null, period.id)}>
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
