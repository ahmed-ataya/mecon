import Link from 'next/link'
import { db } from '@/lib/db'
import { hasAssignmentEnded } from '@/lib/contract-status'
import { toDateInputValue, todayUtc } from '@/lib/dates'
import { loadCustomerOptions } from '@/lib/contract-options'
import { createInvoices } from '@/lib/actions/invoices'
import { GenerateForm } from '@/components/invoices/GenerateForm'

/** Dynamic so the contract list is never baked in at build time. */
export const dynamic = 'force-dynamic'

export default async function NewInvoicePage() {
  const [customers, contracts] = await Promise.all([
    loadCustomerOptions(),
    db.contract.findMany({
      include: {
        lpo: { select: { number: true } },
        equipmentAssignments: {
          include: { equipment: { select: { name: true } } },
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: { mobilizationDate: 'desc' },
    }),
  ])

  // Default to last calendar month, which is how most invoicing here is done.
  const today = todayUtc()
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  )
  const monthEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
  )

  const choices = contracts.map((contract) => {
    const current =
      contract.equipmentAssignments.find(
        (assignment) => !hasAssignmentEnded(assignment),
      ) ?? contract.equipmentAssignments.at(-1)

    return {
      id: contract.id,
      projectName: contract.projectName,
      siteName: contract.siteName,
      customerId: contract.customerId,
      lpoId: contract.lpoId,
      lpoNumber: contract.lpo?.number ?? null,
      machineName: current?.equipment.name ?? null,
      mobilizationDate: contract.mobilizationDate,
      closingDate: contract.closingDate,
    }
  })

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/invoices"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Invoices
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Generate invoices
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Billing walks the assignment history, so a period covering a machine
          swap bills each machine&rsquo;s actual days. Off-hire days are
          deducted and shown.
        </p>
      </div>

      <GenerateForm
        action={createInvoices}
        customers={customers}
        contracts={choices}
        defaultStart={toDateInputValue(monthStart)}
        defaultEnd={toDateInputValue(monthEnd)}
      />
    </div>
  )
}
