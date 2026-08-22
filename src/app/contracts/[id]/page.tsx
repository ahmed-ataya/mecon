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
  hasAssignmentEnded,
} from '@/lib/contract-status'
import { formatDate } from '@/lib/dates'
import { SITE_LABELS, type Site } from '@/lib/enums'
import {
  describeLpo,
  getLpoOpenness,
  LPO_OPENNESS_CLASSES,
  LPO_OPENNESS_LABELS,
} from '@/lib/lpo'
import {
  effectiveCharge,
  explainCharge,
  MOBILIZATION_CHARGE_LABELS,
} from '@/lib/mobilization'
import { EquipmentTimeline } from '@/components/contracts/EquipmentTimeline'
import { OperatorTimeline } from '@/components/contracts/OperatorTimeline'
import { WarningList } from '@/components/contracts/WarningList'
import { buttonSecondaryClass } from '@/components/ui/form'
import { findDeletionRecord } from '@/lib/audit-queries'
import { DeletedRecordNotice } from '@/components/audit/DeletedRecordNotice'
import { RecordHistoryPanel } from '@/components/audit/RecordHistoryPanel'

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

  if (!contract) {
    const deletion = await findDeletionRecord('Contract', id)
    if (deletion) {
      return (
        <DeletedRecordNotice entityTypeLabel="Contract" entityLabel={deletion.entityLabel} />
      )
    }
    notFound()
  }

  // Phase B4/F5: the eligibility check both replacement flows show live
  // needs to know about the OTHER half of the pairing — the current
  // machine's type when replacing the operator, the current operator's
  // certificates when replacing the machine. "One contract per machine"
  // means there's normally exactly one live assignment on each side.
  const currentMachineType =
    contract.equipmentAssignments.find((a) => !hasAssignmentEnded(a))?.equipment
      .type ?? null
  const currentOperatorId = contract.operatorAssignments.find(
    (a) => !hasAssignmentEnded(a),
  )?.operator?.id
  const currentOperator =
    operatorOptions.find((o) => o.value === currentOperatorId) ?? null

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
              {contract.siteName}
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
            label="Location"
            value={contract.siteName}
            hint={`${
              SITE_LABELS[contract.siteRegime as Site] ?? contract.siteRegime
            } certification applies`}
          />
          <Detail
            label="Quotation"
            value={contract.quotationRef || '—'}
            hint="One quotation can cover several contracts"
          />
          <Detail label="Mobilized by" value={contract.mobilizationBy || '—'} />
          <Detail
            label="Mobilization"
            value={MOBILIZATION_CHARGE_LABELS[effectiveCharge(contract)]}
            hint={explainCharge(contract)}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">LPO</h2>
        {contract.lpo ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href={`/lpos/${contract.lpo.id}`}
              className="font-medium text-slate-900 hover:underline"
            >
              {contract.lpo.number}
            </Link>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                LPO_OPENNESS_CLASSES[getLpoOpenness(contract.lpo)]
              }`}
            >
              {LPO_OPENNESS_LABELS[getLpoOpenness(contract.lpo)]}
            </span>
            <span className="text-slate-500">{describeLpo(contract.lpo)}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No LPO recorded yet. Contracts can be entered before the paperwork
            arrives.
          </p>
        )}
      </section>

      <EquipmentTimeline
        assignments={contract.equipmentAssignments}
        equipmentOptions={equipmentOptions}
        siteRegime={contract.siteRegime}
        currentOperator={currentOperator}
      />

      <OperatorTimeline
        assignments={contract.operatorAssignments}
        operatorOptions={operatorOptions}
        siteRegime={contract.siteRegime}
        currentMachineType={currentMachineType}
      />

      <RecordHistoryPanel entityType="Contract" entityId={contract.id} />
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
