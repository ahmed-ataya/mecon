import Link from 'next/link'
import { loadOperatorAssignmentChoices } from '@/lib/timesheet-queries'
import { createOperatorTimesheet } from '@/lib/actions/timesheets'
import { NewTimesheetForm } from '@/components/timesheets/NewTimesheetForm'

export default async function NewOperatorTimesheetPage() {
  const contracts = await loadOperatorAssignmentChoices()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/timesheets"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Timesheets
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New operator timesheet
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Drives payroll, at actual hours — never the billed figure. Daily
          rows are generated for the month, defaulted to 10 hrs on working
          days — every figure stays editable before it&rsquo;s signed.
        </p>
      </div>

      {contracts.length === 0 ? (
        <p className="text-sm text-slate-500">
          No contracts with an operator assigned yet.
        </p>
      ) : (
        <NewTimesheetForm
          action={createOperatorTimesheet}
          contracts={contracts}
          assignmentNoun="operator"
          cancelHref="/timesheets"
        />
      )}
    </div>
  )
}
