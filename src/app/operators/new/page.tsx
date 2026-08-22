import Link from 'next/link'
import { OperatorForm } from '@/components/operators/OperatorForm'
import { createOperator } from '@/lib/actions/operators'
import { loadEquipmentTypeOptions } from '@/lib/equipment-options'
import { requirePageUser } from '@/lib/auth/guard'
import { canViewPayroll } from '@/lib/permissions'

export default async function NewOperatorPage() {
  const currentUser = await requirePageUser()
  const equipmentTypeOptions = await loadEquipmentTypeOptions()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/operators"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Employees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Add employee
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Qatar ID, licences and medical certificates can be added once the
          employee is saved.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <OperatorForm
          action={createOperator}
          equipmentTypeOptions={equipmentTypeOptions}
          submitLabel="Create employee"
          cancelHref="/operators"
          canViewPayroll={canViewPayroll(currentUser.role)}
        />
      </div>
    </div>
  )
}
