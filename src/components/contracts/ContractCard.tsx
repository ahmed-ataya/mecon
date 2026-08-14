'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
  hasAssignmentEnded,
  isAssignmentUpcoming,
  type ContractStatus,
} from '@/lib/contract-status'
import { formatDate } from '@/lib/dates'
import {
  ARRANGEMENT_LABELS,
  ASSIGNMENT_REASON_LABELS,
  SITE_LABELS,
  type Arrangement,
  type Site,
} from '@/lib/enums'
import { formatQar } from '@/lib/money'
import { describeRate } from '@/lib/rates'
import { describeLpo } from '@/lib/lpo'
import {
  effectiveCharge,
  MOBILIZATION_CHARGE_LABELS,
} from '@/lib/mobilization'
import { WARNING_CLASSES, worstSeverity, type Warning } from '@/lib/warnings'

type Assignment = {
  id: string
  startDate: Date
  endDate: Date | null
  reason: string
  note: string | null
}

type EquipmentAssignment = Assignment & {
  rateType: string
  rateAmount: number
  equipment: { id: string; name: string; type: string }
}

type OperatorAssignment = Assignment & {
  arrangement: string
  operatorHourlyCost: number | null
  operator: { id: string; name: string } | null
}

export type ContractCardData = {
  id: string
  projectName: string
  siteName: string
  siteRegime: string
  mobilizationDate: Date
  closingDate: Date | null
  quotationRef: string | null
  mobilizationBy: string | null
  mobilizationCharge: string | null
  lpo: { id: string; number: string; amount: number | null; validity: Date | null } | null
  status: ContractStatus
  warnings: Warning[]
  customer: { id: string; name: string }
  equipmentAssignments: EquipmentAssignment[]
  operatorAssignments: OperatorAssignment[]
}

/**
 * One card per contract on the master view.
 *
 * Shows what is on the contract RIGHT NOW, with the full replacement history
 * tucked behind a toggle — the history matters when reconciling an invoice,
 * but it would drown the everyday view.
 */
export function ContractCard({ contract }: { contract: ContractCardData }) {
  const [showHistory, setShowHistory] = useState(false)

  // Not-ended rather than active-today, so an upcoming contract shows the
  // machines scheduled onto it instead of claiming it has none.
  const currentEquipment = contract.equipmentAssignments.filter(
    (assignment) => !hasAssignmentEnded(assignment),
  )
  const currentOperators = contract.operatorAssignments.filter(
    (assignment) => !hasAssignmentEnded(assignment),
  )

  const replacements =
    contract.equipmentAssignments.length + contract.operatorAssignments.length
  const hasHistory = replacements > 2

  const severity = worstSeverity(contract.warnings)

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
        <div className="min-w-0">
          <Link
            href={`/contracts/${contract.id}`}
            className="font-semibold text-slate-900 hover:underline"
          >
            {contract.projectName}
          </Link>
          <p className="mt-0.5 truncate text-sm text-slate-600">
            {contract.customer.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {contract.siteName}
            <span className="text-slate-400">
              {' · '}
              {SITE_LABELS[contract.siteRegime as Site] ?? contract.siteRegime}
            </span>
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            CONTRACT_STATUS_CLASSES[contract.status]
          }`}
        >
          {CONTRACT_STATUS_LABELS[contract.status]}
        </span>
      </div>

      <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
        <Detail label="Mobilized" value={formatDate(contract.mobilizationDate)} />
        <Detail
          label="Closing"
          value={
            contract.closingDate ? formatDate(contract.closingDate) : 'Ongoing'
          }
        />

        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Machine
          </dt>
          <dd className="mt-1 space-y-1">
            {currentEquipment.length === 0 ? (
              <span className="text-slate-400">None assigned</span>
            ) : (
              currentEquipment.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-wrap items-baseline gap-x-2"
                >
                  <span className="font-medium text-slate-900">
                    {assignment.equipment.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {describeRate(assignment.rateAmount, assignment.rateType)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {isAssignmentUpcoming(assignment) ? 'from' : 'since'}{' '}
                    {formatDate(assignment.startDate)}
                  </span>
                </div>
              ))
            )}
          </dd>
        </div>

        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Operator
          </dt>
          <dd className="mt-1 space-y-1">
            {currentOperators.length === 0 ? (
              <span className="text-slate-400">None assigned</span>
            ) : (
              currentOperators.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-wrap items-baseline gap-x-2"
                >
                  <span className="font-medium text-slate-900">
                    {assignment.operator?.name ?? 'Without operator'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {ARRANGEMENT_LABELS[assignment.arrangement as Arrangement] ??
                      assignment.arrangement}
                  </span>
                  {assignment.operatorHourlyCost !== null && (
                    <span className="text-xs text-slate-400">
                      cost {formatQar(assignment.operatorHourlyCost)}/hr
                    </span>
                  )}
                </div>
              ))
            )}
          </dd>
        </div>

        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Mobilization
          </dt>
          <dd className="mt-0.5 text-slate-900">
            {MOBILIZATION_CHARGE_LABELS[effectiveCharge(contract)]}
            {contract.mobilizationBy && (
              <span className="text-slate-500">
                {' · by '}
                {contract.mobilizationBy}
              </span>
            )}
            {contract.quotationRef && (
              <span className="text-slate-500">
                {' · quote '}
                {contract.quotationRef}
              </span>
            )}
          </dd>
        </div>

        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">LPO</dt>
          <dd className="mt-0.5 text-slate-900">
            {contract.lpo ? (
              <>
                <Link
                  href={`/lpos/${contract.lpo.id}`}
                  className="hover:underline"
                >
                  {contract.lpo.number}
                </Link>
                <span className="text-slate-500">
                  {' · '}
                  {describeLpo(contract.lpo)}
                </span>
              </>
            ) : (
              <span className="text-slate-400">Not recorded</span>
            )}
          </dd>
        </div>
      </dl>

      {severity && (
        <div className="px-5 pb-5">
          <div
            className={`rounded-md px-3 py-2 text-xs ring-1 ring-inset ${WARNING_CLASSES[severity]}`}
          >
            <ul className="space-y-1">
              {contract.warnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>{warning.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {hasHistory && (
        <div className="border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => setShowHistory((open) => !open)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            {showHistory ? 'Hide' : 'Show'} replacement history (
            {replacements - 2})
          </button>

          {showHistory && (
            <div className="mt-3 space-y-3 text-xs">
              <HistoryList
                title="Equipment"
                rows={contract.equipmentAssignments.map((assignment) => ({
                  id: assignment.id,
                  name: assignment.equipment.name,
                  startDate: assignment.startDate,
                  endDate: assignment.endDate,
                  reason: assignment.reason,
                }))}
              />
              <HistoryList
                title="Operator"
                rows={contract.operatorAssignments.map((assignment) => ({
                  id: assignment.id,
                  name: assignment.operator?.name ?? 'Without operator',
                  startDate: assignment.startDate,
                  endDate: assignment.endDate,
                  reason: assignment.reason,
                }))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryList({
  title,
  rows,
}: {
  title: string
  rows: {
    id: string
    name: string
    startDate: Date
    endDate: Date | null
    reason: string
  }[]
}) {
  if (rows.length === 0) return null

  return (
    <div>
      <p className="mb-1 font-medium text-slate-700">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap gap-x-2 text-slate-600">
            <span className="font-medium text-slate-900">{row.name}</span>
            <span>
              {formatDate(row.startDate)} –{' '}
              {row.endDate ? formatDate(row.endDate) : 'current'}
            </span>
            <span className="text-slate-400">
              {ASSIGNMENT_REASON_LABELS[row.reason] ?? row.reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  )
}
