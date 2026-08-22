import Link from 'next/link'
import { formatDate } from '@/lib/dates'
import { loadPublicHolidays } from '@/lib/leave-queries'
import { deletePublicHoliday } from '@/lib/actions/leave'
import { PublicHolidayForm } from '@/components/leave/PublicHolidayForm'

export default async function PublicHolidaysPage() {
  const holidays = await loadPublicHolidays()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leave" className="text-sm text-slate-500 hover:text-slate-900">
          ← Leave
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Public holidays
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          A public holiday landing inside an approved annual leave request
          doesn&rsquo;t consume a day from the balance. Dates are moon-
          sighting based for the Islamic holidays, so they&rsquo;re entered
          here rather than guessed at in code — same reasoning as Ramadan
          periods.
        </p>
      </div>

      <PublicHolidayForm />

      {holidays.length === 0 ? (
        <p className="text-sm text-slate-500">No public holidays recorded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full max-w-lg text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td className="px-4 py-3 text-slate-900">{holiday.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(holiday.startDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(holiday.endDate)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deletePublicHoliday.bind(null, holiday.id)}>
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
