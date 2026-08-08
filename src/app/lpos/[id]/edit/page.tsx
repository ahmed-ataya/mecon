import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { LpoForm } from '@/components/lpos/LpoForm'
import { updateLpo } from '@/lib/actions/lpos'
import { loadCustomerOptions } from '@/lib/contract-options'

export default async function EditLpoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [lpo, customers] = await Promise.all([
    db.lpo.findUnique({ where: { id } }),
    loadCustomerOptions(),
  ])

  if (!lpo) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/lpos/${id}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← {lpo.number}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit LPO</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <LpoForm
          action={updateLpo.bind(null, id)}
          customers={customers}
          lpo={lpo}
          submitLabel="Save changes"
          cancelHref={`/lpos/${id}`}
        />
      </div>
    </div>
  )
}
