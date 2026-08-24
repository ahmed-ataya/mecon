import Link from 'next/link'
import { db } from '@/lib/db'
import { rollUpStatus, summarizeStatuses } from '@/lib/document-status'
import { computeCompleteness } from '@/lib/document-completeness'
import {
  EMPLOYEE_CATEGORIES,
  EMPLOYEE_CATEGORY_DOCUMENT_TYPES,
  EMPLOYEE_CATEGORY_LABELS,
  OPERATOR_SOURCE_LABELS,
  type EmployeeCategory,
  type OperatorSource,
} from '@/lib/enums'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { CompletenessBadge } from '@/components/documents/CompletenessBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { buttonPrimaryClass } from '@/components/ui/form'

/** "All" plus every real category — same pill-tab pattern the contracts
 * list already uses, so filtering behaves the same way everywhere. */
const CATEGORY_FILTERS = [
  { key: 'ALL', label: 'All' },
  ...EMPLOYEE_CATEGORIES.map((key) => ({
    key,
    label: EMPLOYEE_CATEGORY_LABELS[key],
  })),
] as const

type CategoryFilterKey = (typeof CATEGORY_FILTERS)[number]['key']

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const { q, category } = await searchParams
  const query = q?.trim() ?? ''
  const activeCategory: CategoryFilterKey = CATEGORY_FILTERS.some(
    (f) => f.key === category,
  )
    ? (category as CategoryFilterKey)
    : 'ALL'

  const operators = await db.employee.findMany({
    where: {
      ...(activeCategory !== 'ALL' ? { category: activeCategory } : {}),
      ...(query
        ? {
            OR: [
              // Postgres LIKE is case-sensitive — see customers/page.tsx
              { name: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
              { nationality: { contains: query, mode: 'insensitive' } },
              { employeeNumber: { contains: query, mode: 'insensitive' } },
              { jobTitle: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { documents: true, qualifications: true },
    orderBy: { name: 'asc' },
  })

  // Counts for the tabs — always across the full (unfiltered by category)
  // set, so the numbers don't shift as you switch tabs, only the rows do.
  const forCounts = await db.employee.findMany({ select: { category: true } })
  const counts: Record<CategoryFilterKey, number> = {
    ALL: forCounts.length,
    OPERATOR: 0,
    DRIVER: 0,
    MECHANIC_WORKSHOP: 0,
    HELPER_LABOURER: 0,
    ADMIN_OFFICE: 0,
    MANAGEMENT: 0,
  }
  for (const row of forCounts) {
    counts[row.category as EmployeeCategory] += 1
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {operators.length} {operators.length === 1 ? 'employee' : 'employees'}
            {query && ' matching your search'}
          </p>
        </div>
        <Link href="/operators/new" className={buttonPrimaryClass}>
          Add employee
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((option) => {
          const isActive = option.key === activeCategory

          return (
            <Link
              key={option.key}
              href={`/operators?category=${option.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${
                isActive
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {option.label}
              <span
                className={`ml-1.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}
              >
                {counts[option.key]}
              </span>
            </Link>
          )
        })}
      </div>

      <SearchInput placeholder="Search by name, staff no., job title, phone or nationality…" />

      {operators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {query
              ? `No employees match “${query}”.`
              : 'No employees yet. Add the first one to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm [&_td]:align-top">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Job title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Documents</th>
                <th className="px-4 py-3 font-medium">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operators.map((operator) => {
                const empCategory = operator.category as EmployeeCategory
                const status = rollUpStatus(operator.documents)
                const { expired, expiringSoon, total } = summarizeStatuses(
                  operator.documents,
                )
                const completeness = computeCompleteness(
                  'OPERATOR',
                  operator.documents,
                  operator.qualifications.map((q) => q.equipmentType),
                  EMPLOYEE_CATEGORY_DOCUMENT_TYPES[empCategory],
                )

                return (
                  <tr key={operator.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/operators/${operator.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {operator.name}
                      </Link>
                      {operator.employeeNumber && (
                        <div className="text-xs text-slate-500">
                          #{operator.employeeNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {operator.jobTitle ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {EMPLOYEE_CATEGORY_LABELS[empCategory] ?? operator.category}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {OPERATOR_SOURCE_LABELS[
                        operator.source as OperatorSource
                      ] ?? operator.source}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status} />
                        <span className="text-xs whitespace-nowrap text-slate-500">
                          {total === 0
                            ? 'none on file'
                            : [
                                expired > 0 && `${expired} expired`,
                                expiringSoon > 0 && `${expiringSoon} expiring`,
                              ]
                                .filter(Boolean)
                                .join(' · ') || `${total} on file`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CompletenessBadge completeness={completeness} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
