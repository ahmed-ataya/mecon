import Link from 'next/link'
import { ContractForm } from '@/components/contracts/ContractForm'
import { createContract } from '@/lib/actions/contracts'
import {
  loadCustomerOptions,
  loadEquipmentOptions,
  loadLocationOptions,
  loadOperatorOptions,
} from '@/lib/contract-options'

/**
 * Rendered per request, never prerendered.
 *
 * This page has no searchParams, so Next would otherwise treat it as static
 * and bake the customer, equipment and operator dropdowns in at BUILD time —
 * a customer added afterwards would silently never appear in the list.
 */
export const dynamic = 'force-dynamic'

export default async function NewContractPage() {
  const [customers, equipment, operators, locations] = await Promise.all([
    loadCustomerOptions(),
    loadEquipmentOptions(),
    loadOperatorOptions(),
    loadLocationOptions(),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/contracts"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New contract
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          A contract belongs to a project. Machines and operators are assigned
          underneath it and can change without affecting the contract itself.
        </p>
      </div>

      <ContractForm
        action={createContract}
        customers={customers}
        equipment={equipment}
        operators={operators}
        locations={locations}
        cancelHref="/contracts"
      />
    </div>
  )
}
