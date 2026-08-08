import Link from 'next/link'
import { LpoForm } from '@/components/lpos/LpoForm'
import { createLpo } from '@/lib/actions/lpos'
import { loadCustomerOptions } from '@/lib/contract-options'

/** Dynamic so the customer list is never baked in at build time. */
export const dynamic = 'force-dynamic'

export default async function NewLpoPage() {
  const customers = await loadCustomerOptions()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/lpos" className="text-sm text-slate-500 hover:text-slate-900">
          ← LPOs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add LPO</h1>
        <p className="mt-1 text-sm text-slate-500">
          One LPO can cover several machines. Each machine is its own contract,
          and they all point back at this record.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <LpoForm
          action={createLpo}
          customers={customers}
          submitLabel="Create LPO"
          cancelHref="/lpos"
        />
      </div>
    </div>
  )
}
