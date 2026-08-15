import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { OperatorForm } from '@/components/operators/OperatorForm'
import { updateOperator } from '@/lib/actions/operators'
import { loadEquipmentTypeOptions } from '@/lib/equipment-options'

export default async function EditOperatorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [operator, equipmentTypeOptions] = await Promise.all([
    db.employee.findUnique({
      where: { id },
      include: { qualifications: true },
    }),
    loadEquipmentTypeOptions(),
  ])

  // See src/app/operators/[id]/page.tsx for why category is checked here too.
  if (!operator || operator.category !== 'OPERATOR') notFound()

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
          Edit operator
        </h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <OperatorForm
          action={action}
          operator={operator}
          equipmentTypeOptions={equipmentTypeOptions}
          qualifiedTypes={operator.qualifications.map((q) => q.equipmentType)}
          submitLabel="Save changes"
          cancelHref={`/operators/${id}`}
        />
      </div>
    </div>
  )
}
