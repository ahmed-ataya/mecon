import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { OperatorForm } from '@/components/operators/OperatorForm'
import { updateOperator } from '@/lib/actions/operators'
import { loadEquipmentTypeOptions } from '@/lib/equipment-options'
import { requirePageUser } from '@/lib/auth/guard'
import { canViewPayroll } from '@/lib/permissions'

export default async function EditOperatorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const currentUser = await requirePageUser()
  const { id } = await params
  const [operator, equipmentTypeOptions] = await Promise.all([
    db.employee.findUnique({
      where: { id },
      include: { qualifications: true },
    }),
    loadEquipmentTypeOptions(),
  ])

  if (!operator) notFound()

  const showPayroll = canViewPayroll(currentUser.role)
  // Salary/bank data never reaches this page's client bundle for a role
  // that can't see it — hiding the fieldset alone would still leak the
  // numbers through the page's own serialized props.
  const operatorForForm = showPayroll
    ? operator
    : {
        ...operator,
        basicSalary: null,
        housingAllowance: null,
        transportAllowance: null,
        foodAllowance: null,
        siteAllowance: null,
        otherAllowance: null,
        bankName: null,
        bankAccountNumber: null,
      }

  // Bind the id so the shared form keeps the same (state, formData) shape.
  const action = updateOperator.bind(null, id)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/operators/${id}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← {operator.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit employee
        </h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <OperatorForm
          action={action}
          operator={operatorForForm}
          equipmentTypeOptions={equipmentTypeOptions}
          qualifiedTypes={operator.qualifications.map((q) => q.equipmentType)}
          submitLabel="Save changes"
          cancelHref={`/operators/${id}`}
          canViewPayroll={showPayroll}
        />
      </div>
    </div>
  )
}
