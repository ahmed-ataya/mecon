import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { CustomerForm } from '@/components/customers/CustomerForm'
import { updateCustomer } from '@/lib/actions/customers'

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const customer = await db.customer.findUnique({ where: { id } })

  if (!customer) notFound()

  // Bind the id so the shared form keeps the same (state, formData) shape.
  const action = updateCustomer.bind(null, id)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/customers/${id}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← {customer.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit customer
        </h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <CustomerForm
          action={action}
          customer={customer}
          submitLabel="Save changes"
          cancelHref={`/customers/${id}`}
        />
      </div>
    </div>
  )
}
