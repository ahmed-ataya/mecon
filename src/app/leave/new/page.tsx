import Link from 'next/link'
import { loadEmployeeOptions } from '@/lib/leave-queries'
import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm'

export default async function NewLeaveRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>
}) {
  const [employees, { employeeId }] = await Promise.all([
    loadEmployeeOptions(),
    searchParams,
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leave" className="text-sm text-slate-500 hover:text-slate-900">
          ← Leave
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Request leave
        </h1>
      </div>

      <LeaveRequestForm
        employeeOptions={employees.map((e) => ({ value: e.id, label: e.label }))}
        defaultEmployeeId={employeeId}
        cancelHref="/leave"
      />
    </div>
  )
}
