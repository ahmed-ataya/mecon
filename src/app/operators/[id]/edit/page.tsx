import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { OperatorForm } from '@/components/operators/OperatorForm'
import { updateOperator } from '@/lib/actions/operators'

export default async function EditOperatorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const operator = await db.operator.findUnique({ where: { id } })

  if (!operator) notFound()

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
          submitLabel="Save changes"
          cancelHref={`/operators/${id}`}
        />
      </div>
    </div>
  )
}
