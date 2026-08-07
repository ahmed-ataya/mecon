import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadContract } from '@/lib/contract-queries'
import {
  loadEquipmentOptions,
  loadOperatorOptions,
} from '@/lib/contract-options'
import {
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
} from '@/lib/contract-status'
import { formatDate } from '@/lib/dates'
import { SITE_LABELS, type Site } from '@/lib/enums'
import { formatQar } from '@/lib/money'
import { EquipmentTimeline } from '@/components/contracts/EquipmentTimeline'
import { OperatorTimeline } from '@/components/contracts/OperatorTimeline'
import { WarningList } from '@/components/contracts/WarningList'
import { buttonSecondaryClass } from '@/components/ui/form'

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [contract, equipmentOptions, operatorOptions] = await Promise.all([
    loadContract(id),
    loadEquipmentOptions(),
    loadOperatorOptions(),
  ])

  if (!contract) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/contracts"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Contracts
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {contract.projectName}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  CONTRACT_STATUS_CLASSES[contract.status]
                }`}
              >
                {CONTRACT_STATUS_LABELS[contract.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <Link
                href={`/customers/${contract.customer.id}`}
                className="hover:underline"
              >
                {contract.customer.name}
              </Link>
              {' · '}
              {SITE_LABELS[contract.site as Site] ?? contract.site}
            </p>
          </div>

          <Link
            href={`/contracts/${contract.id}/edit`}
            className={buttonSecondaryClass}
          >
            Edit contract
          </Link>
        </div>
      </div>

      <WarningList warnings={contract.warnings} title="Needs attention" />

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Contract</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Detail
            label="Mobilization date"
            value={formatDate(contract.mobilizationDate)}
            hint="Fixed — belongs to the project"
          />
          <Detail
            label="Closing date"
            value={
              contract.closingDate
                ? formatDate(contract.closingDate)
                : 'Ongoing'
            }
          />
          <Detail
            label="Site"
            value={SITE_LABELS[contract.site as Site] ?? contract.site}
          />
          <Detail label="LPO number" value={contract.lpoNumber || '—'} />
          <Detail
            label="LPO validity"
            value={
              contract.lpoValidity ? formatDate(contract.lpoValidity) : '—'
            }
          />
          <Detail label="LPO amount" value={formatQar(contract.lpoAmount)} />
        </dl>
      </section>

      <EquipmentTimeline
        contractId={contract.id}
        assignments={contract.equipmentAssignments}
        equipmentOptions={equipmentOptions}
      />

      <OperatorTimeline
        assignments={contract.operatorAssignments}
        operatorOptions={operatorOptions}
      />
    </div>
  )
}

function Detail({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
