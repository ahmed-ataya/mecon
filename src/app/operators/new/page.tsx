import Link from 'next/link'
import { OperatorForm } from '@/components/operators/OperatorForm'
import { createOperator } from '@/lib/actions/operators'

export default function NewOperatorPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/operators"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Operators
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Add operator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Qatar ID, licences and medical certificates can be added once the
          operator is saved.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <OperatorForm
          action={createOperator}
          submitLabel="Create operator"
          cancelHref="/operators"
        />
      </div>
    </div>
  )
}
