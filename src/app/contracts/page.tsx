import Link from 'next/link'
import { loadContracts } from '@/lib/contract-queries'
import { SITE_LABELS, type Site } from '@/lib/enums'
import { ContractCard } from '@/components/contracts/ContractCard'
import { SearchInput } from '@/components/ui/SearchInput'
import { buttonPrimaryClass } from '@/components/ui/form'
import { PageHeader } from '@/components/shell/PageHeader'

/**
 * Master view. "Needs attention" is not a status — it cuts across the others,
 * so it filters on warnings rather than on dates. See contract-status.ts.
 */
const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q, filter } = await searchParams
  const query = q?.trim().toLowerCase() ?? ''
  const active: FilterKey = FILTERS.some((f) => f.key === filter)
    ? (filter as FilterKey)
    : 'active'

  const all = await loadContracts()

  const counts = {
    active: all.filter((c) => c.status === 'ACTIVE').length,
    attention: all.filter((c) => c.warnings.length > 0).length,
    upcoming: all.filter((c) => c.status === 'UPCOMING').length,
    closed: all.filter((c) => c.status === 'CLOSED').length,
    all: all.length,
  }

  const byFilter = all.filter((contract) => {
    if (active === 'active') return contract.status === 'ACTIVE'
    if (active === 'upcoming') return contract.status === 'UPCOMING'
    if (active === 'closed') return contract.status === 'CLOSED'
    if (active === 'attention') return contract.warnings.length > 0
    return true
  })

  // Search covers everything visible on a card, including the machines and
  // operators currently on it — that is how people actually look for a job.
  const contracts = query
    ? byFilter.filter((contract) =>
        [
          contract.projectName,
          contract.customer.name,
          contract.lpo?.number ?? '',
          contract.quotationRef ?? '',
          contract.siteName,
          SITE_LABELS[contract.siteRegime as Site] ?? contract.siteRegime,
          ...contract.equipmentAssignments.map((a) => a.equipment.name),
          ...contract.operatorAssignments.map((a) => a.operator?.name ?? ''),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : byFilter

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description={`${contracts.length} ${contracts.length === 1 ? 'contract' : 'contracts'}${query ? ' matching your search' : ''}`}
        actions={
          <Link href="/contracts/new" className={buttonPrimaryClass}>
            New contract
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const isActive = option.key === active
          const count = counts[option.key]

          return (
            <Link
              key={option.key}
              href={`/contracts?filter=${option.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
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
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      <SearchInput placeholder="Search project, customer, LPO, machine or operator…" />

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {all.length === 0
              ? 'No contracts yet. Create the first one to get started.'
              : 'No contracts match this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      )}
    </div>
  )
}
