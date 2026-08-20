import Link from 'next/link'
import { formatDate } from '@/lib/dates'
import { loadRamadanPeriods } from '@/lib/payroll-queries'
import { deleteRamadanPeriod } from '@/lib/actions/ramadan'
import { RamadanPeriodForm } from '@/components/payroll/RamadanPeriodForm'

export default async function RamadanPeriodsPage() {
  const periods = await loadRamadanPeriods()

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
          Ramadan periods
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Standard hours drop to 6/day, 36/week for any payroll day falling
          inside one of these — no pay reduction. Dates are moon-sighting
          based, so they&rsquo;re entered here rather than guessed at in
          code.
        </p>
      </div>

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
