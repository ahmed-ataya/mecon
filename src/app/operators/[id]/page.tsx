import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { rollUpStatus, summarizeStatuses } from '@/lib/document-status'
import { computeCompleteness } from '@/lib/document-completeness'
import {
  EMPLOYEE_CATEGORY_DOCUMENT_TYPES,
  EMPLOYEE_CATEGORY_LABELS,
  OPERATOR_SOURCE_LABELS,
  type EmployeeCategory,
  type OperatorSource,
} from '@/lib/enums'
import { loadEquipmentTypeOptions } from '@/lib/equipment-options'
import {
  serializeDocument,
  sortDocumentsByUrgency,
} from '@/lib/serialize-document'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CompletenessCard } from '@/components/documents/CompletenessBar'
import { DocumentsSection } from '@/components/documents/DocumentsSection'
import { buttonPrimaryClass, buttonSecondaryClass } from '@/components/ui/form'
import { loadEmployeeLeaveSummary } from '@/lib/leave-queries'
import { deriveEmployeeStatus, EMPLOYEE_STATUS_LABELS } from '@/lib/employee-status'
import { formatDate, todayUtc } from '@/lib/dates'
import { LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, type LeaveStatus, type LeaveType } from '@/lib/enums'

export default async function OperatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [operator, equipmentTypeOptions, leaveSummary] = await Promise.all([
    db.employee.findUnique({
      where: { id },
      include: {
        documents: { include: { approvedFor: true } },
        qualifications: { orderBy: { equipmentType: 'asc' } },
      },
    }),
    loadEquipmentTypeOptions(),
    loadEmployeeLeaveSummary(id),
  ])

  // General employee page since Phase E0/HR (2026-08-20) — every category
  // is valid here now, not just Operator.
  if (!operator) notFound()

  const employeeStatus = deriveEmployeeStatus({
    dateOfExit: operator.dateOfExit,
    isOnApprovedLeaveToday: leaveSummary?.isOnApprovedLeaveToday ?? false,
    asOfDate: todayUtc(),
  })

  const category = operator.category as EmployeeCategory
  const isOperator = category === 'OPERATOR'

  const status = rollUpStatus(operator.documents)
  const { expired, expiringSoon } = summarizeStatuses(operator.documents)
  const documents = sortDocumentsByUrgency(
    operator.documents.map(serializeDocument),
  )
  const completeness = computeCompleteness(
    'OPERATOR',
    operator.documents,
    operator.qualifications.map((q) => q.equipmentType),
    EMPLOYEE_CATEGORY_DOCUMENT_TYPES[category],
  )
  const sourceLabel =
    OPERATOR_SOURCE_LABELS[operator.source as OperatorSource] ?? operator.source
  const categoryLabel = EMPLOYEE_CATEGORY_LABELS[category] ?? operator.category

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/operators"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Employees
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {operator.name}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {operator.jobTitle ? `${operator.jobTitle} · ` : `${categoryLabel} · `}
              {sourceLabel}
              {operator.nationality && ` · ${operator.nationality}`}
              {' · '}
              {EMPLOYEE_STATUS_LABELS[employeeStatus]}
            </p>
          </div>
          <Link
            href={`/operators/${operator.id}/edit`}
            className={buttonSecondaryClass}
          >
            Edit
          </Link>
        </div>
      </div>

      {(expired > 0 || expiringSoon > 0) && (
        <div
          className={`rounded-md px-4 py-3 text-sm ring-1 ring-inset ${
            expired > 0
              ? 'bg-red-50 text-red-700 ring-red-200'
              : 'bg-amber-50 text-amber-800 ring-amber-200'
          }`}
        >
          {expired > 0 && (
            <p>
              <strong>
                {expired} document{expired === 1 ? '' : 's'} expired.
              </strong>{' '}
              This employee should not be working until these are renewed.
            </p>
          )}
          {expiringSoon > 0 && (
            <p className={expired > 0 ? 'mt-1' : undefined}>
              {expiringSoon} document{expiringSoon === 1 ? '' : 's'} expiring
              soon.
            </p>
          )}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Details</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Employee number" value={operator.employeeNumber} />
          <Detail label="Job title" value={operator.jobTitle} />
          <Detail label="Category" value={categoryLabel} />
          <Detail label="Source" value={sourceLabel} />
          <Detail label="Phone" value={operator.phone} />
          <Detail label="Nationality" value={operator.nationality} />
          <Detail
            label="Date of joining"
            value={operator.dateOfJoining ? formatDate(operator.dateOfJoining) : null}
          />
          <Detail
            label="Date of exit"
            value={operator.dateOfExit ? formatDate(operator.dateOfExit) : null}
          />
          {isOperator && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Qualified to operate
              </dt>
              <dd className="mt-1">
                {operator.qualifications.length === 0 ? (
                  <span className="text-slate-900">—</span>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {operator.qualifications.map((q) => (
                      <li
                        key={q.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800"
                      >
                        {q.equipmentType}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          )}
          <Detail label="Notes" value={operator.notes} />
        </dl>
      </section>

      <CompletenessCard completeness={completeness} />

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Leave</h2>
          <Link
            href={`/leave/new?employeeId=${operator.id}`}
            className={buttonPrimaryClass}
          >
            Request leave
          </Link>
        </div>

        {leaveSummary && leaveSummary.balance.eligible ? (
          <dl className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Balance label="Entitlement (this year)" value={leaveSummary.balance.entitlementDaysThisYear} />
            <Balance label="Carried in" value={leaveSummary.balance.carriedInDays} />
            <Balance label="Taken this year" value={leaveSummary.balance.takenDaysThisYear} />
            <Balance label="Annual leave balance" value={leaveSummary.balance.balanceDays} bold />
          </dl>
        ) : (
          <p className="mb-4 text-sm text-slate-500">
            {operator.dateOfJoining
              ? 'Not yet eligible for annual leave — under 1 year of service.'
              : 'Add a date of joining to see this employee’s annual leave balance.'}
          </p>
        )}

        {!leaveSummary || leaveSummary.requests.length === 0 ? (
          <p className="text-sm text-slate-500">No leave requests on record.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Dates</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveSummary.requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <Link href={`/leave/${r.id}`} className="hover:underline">
                        {LEAVE_TYPE_LABELS[r.leaveType as LeaveType] ?? r.leaveType}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {LEAVE_STATUS_LABELS[r.status as LeaveStatus] ?? r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DocumentsSection
        ownerType="OPERATOR"
        ownerId={operator.id}
        documents={documents}
        equipmentTypeOptions={equipmentTypeOptions}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value || '—'}</dd>
    </div>
  )
}

function Balance({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 ${bold ? 'text-lg font-semibold text-slate-900' : 'text-slate-900'}`}>
        {value} days
      </dd>
    </div>
  )
}
