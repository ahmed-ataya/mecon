import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/dates'
import { formatQar } from '@/lib/money'
import {
  getLpoOpenness,
  LPO_OPENNESS_CLASSES,
  LPO_OPENNESS_LABELS,
  lpoValidityWarnings,
} from '@/lib/lpo'
import {
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
  getContractStatus,
  hasAssignmentEnded,
} from '@/lib/contract-status'
import { WarningList } from '@/components/contracts/WarningList'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function LpoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const lpo = await db.lpo.findUnique({
    where: { id },
    include: {
      customer: true,
      contracts: {
        include: {
          equipmentAssignments: {
            include: { equipment: { select: { name: true } } },
            orderBy: { startDate: 'asc' },
          },
        },
        orderBy: { mobilizationDate: 'asc' },
      },
    },
  })

  if (!lpo) notFound()

  const openness = getLpoOpenness(lpo)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lpos" className="text-sm text-slate-500 hover:text-slate-900">
          ← LPOs
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {lpo.number}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${LPO_OPENNESS_CLASSES[openness]}`}
              >
                {LPO_OPENNESS_LABELS[openness]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <Link
                href={`/customers/${lpo.customerId}`}
                className="hover:underline"
              >
                {lpo.customer.name}
              </Link>
            </p>
          </div>

          <Link href={`/lpos/${lpo.id}/edit`} className={buttonSecondaryClass}>
            Edit LPO
          </Link>
        </div>
      </div>

      <WarningList warnings={lpoValidityWarnings(lpo)} title="Needs attention" />

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Details</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Amount
            </dt>
            <dd className="mt-0.5 text-slate-900">
              {lpo.amount === null ? 'Open — no ceiling' : formatQar(lpo.amount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Issued
            </dt>
            <dd className="mt-0.5 text-slate-900">
              {lpo.issuedDate ? formatDate(lpo.issuedDate) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Expiry
            </dt>
            <dd className="mt-0.5 text-slate-900">
              {lpo.validity === null
                ? 'Open — no end date'
                : formatDate(lpo.validity)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Contracts
            </dt>
            <dd className="mt-0.5 text-slate-900">{lpo.contracts.length}</dd>
          </div>
          {lpo.notes && (
            <div className="sm:col-span-3">
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Notes
              </dt>
              <dd className="mt-0.5 text-slate-900">{lpo.notes}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="font-semibold">Contracts under this LPO</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            One contract per machine. Consumption against the amount is totalled
            across all of them in phase 3.
          </p>
        </div>

        {lpo.contracts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No contracts reference this LPO yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lpo.contracts.map((contract) => {
              const status = getContractStatus(contract)
              const current = contract.equipmentAssignments.find(
                (assignment) => !hasAssignmentEnded(assignment),
              )

              return (
                <li key={contract.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link
                    href={`/contracts/${contract.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {contract.projectName}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${CONTRACT_STATUS_CLASSES[status]}`}
                  >
                    {CONTRACT_STATUS_LABELS[status]}
                  </span>
                  <span className="text-sm text-slate-500">
                    {current?.equipment.name ?? 'No machine assigned'}
                  </span>
                  <span className="text-xs text-slate-400">
                    mobilized {formatDate(contract.mobilizationDate)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
