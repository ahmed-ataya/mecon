import Link from 'next/link'
import { CustomerForm } from '@/components/customers/CustomerForm'
import { createCustomer } from '@/lib/actions/customers'

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/customers"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Add customer
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Documents can be added once the customer is saved.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <CustomerForm
          action={createCustomer}
          submitLabel="Create customer"
          cancelHref="/customers"
        />
      </div>
    </div>
  )
}
