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
          include: {
            equipment: { select: { name: true } },
            offHirePeriods: true,
          },
          orderBy: { startDate: 'asc' },
        },
        // What has already been billed, so the form can show what is left
        // rather than making someone go and look it up on the contract.
        invoices: { include: { invoice: true } },
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

    // When the machine actually started, which is not the mobilization date:
    // a machine mobilized on the 1st often starts working on the 2nd.
    const starts = contract.equipmentAssignments.map((a) => a.startDate)
    const workedFrom =
      starts.length > 0
        ? starts.reduce((min, date) => (date < min ? date : min))
        : null

    // Still running if any assignment is open. Otherwise the last end date,
    // bounded by the contract's own closing date.
    const stillRunning = contract.equipmentAssignments.some(
      (a) => a.endDate === null,
    )
    const ends = contract.equipmentAssignments
      .map((a) => a.endDate)
      .filter((date): date is Date => date !== null)
    const lastEnd =
      ends.length > 0 ? ends.reduce((max, d) => (d > max ? d : max)) : null

    let workedTo: Date | null = stillRunning ? null : lastEnd
    if (contract.closingDate && (workedTo === null || workedTo > contract.closingDate)) {
      workedTo = contract.closingDate
    }

    // Drafts count: a draft already covers its period, and generating the same
    // month twice would silently double-bill once both were issued.
    const periodEnds = contract.invoices.map((row) => row.invoice.periodEnd)
    const invoicedThrough =
      periodEnds.length > 0
        ? periodEnds.reduce((max, d) => (d > max ? d : max))
        : null
    const hasDraft = contract.invoices.some(
      (row) => row.invoice.status === 'DRAFT',
    )

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
      workedFrom,
      workedTo,
      invoicedThrough,
      hasDraft,
      // Every assignment, not just the current one: the rate audit runs per
      // machine, and a period covering a swap has to judge each machine's own
      // quoted period against its own days.
      assignments: contract.equipmentAssignments.map((assignment) => ({
        equipmentName: assignment.equipment.name,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        rateType: assignment.rateType,
        offHire: assignment.offHirePeriods.map((period) => ({
          startDate: period.startDate,
          endDate: period.endDate,
        })),
      })),
      // Drawn in red on the bar — never billable, so it must be visible next
      // to the days that are.
      offHire: contract.equipmentAssignments.flatMap((assignment) =>
        assignment.offHirePeriods.map((period) => ({
          startDate: period.startDate,
          endDate: period.endDate,
        })),
      ),
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
