import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { ContractDetailsForm } from '@/components/contracts/ContractDetailsForm'
import { updateContract } from '@/lib/actions/contracts'
import {
  loadCustomerOptions,
  loadLocationOptions,
  loadLpoOptions,
  loadMobilizedByOptions,
} from '@/lib/contract-options'

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [contract, customers, locations, lpos, mobilizedByOptions] =
    await Promise.all([
      db.contract.findUnique({ where: { id } }),
      loadCustomerOptions(),
      loadLocationOptions(),
      loadLpoOptions(),
      loadMobilizedByOptions(),
    ])

  if (!contract) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/contracts/${id}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← {contract.projectName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit contract
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          The machine and operator are changed from the contract page, so their
          history is preserved. This form covers the project itself.
        </p>
      </div>

      <ContractDetailsForm
        action={updateContract.bind(null, id)}
        customers={customers}
        locations={locations}
        lpos={lpos}
        mobilizedByOptions={mobilizedByOptions}
        contract={contract}
        cancelHref={`/contracts/${id}`}
      />
    </div>
  )
}
