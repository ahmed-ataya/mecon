import { formatDate } from '@/lib/dates'
import { loadPublicHolidays } from '@/lib/leave-queries'
import { deletePublicHoliday } from '@/lib/actions/leave'
import { PublicHolidayForm } from '@/components/leave/PublicHolidayForm'
import { PageHeader } from '@/components/shell/PageHeader'

export default async function PublicHolidaysPage() {
  const holidays = await loadPublicHolidays()

  return (
    <div className="space-y-6">
      <PageHeader
        crumb="Leave"
        crumbHref="/leave"
        title="Public holidays"
        description="A public holiday landing inside an approved annual leave request doesn’t consume a day from the balance. Dates are moon-sighting based for the Islamic holidays, so they’re entered here rather than guessed at in code — same reasoning as Ramadan periods."
      />

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
