import Link from 'next/link'
import {
  EMPLOYEE_CATEGORIES,
  EMPLOYEE_CATEGORY_LABELS,
  LEAVE_TYPE_LABELS,
  type EmployeeCategory,
  type LeaveType,
} from '@/lib/enums'
import { monthLabel } from '@/lib/timesheet'
import { loadLeaveCalendar } from '@/lib/leave-queries'

const LEAVE_TYPE_DOT: Record<LeaveType, string> = {
  ANNUAL: 'bg-blue-500',
  SICK: 'bg-red-500',
  UNPAID: 'bg-slate-400',
  HAJJ: 'bg-purple-500',
  MATERNITY: 'bg-pink-500',
  EMERGENCY: 'bg-orange-500',
  PUBLIC_HOLIDAY: 'bg-green-500',
}

function pillClass(active: boolean) {
  return `rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
    active
      ? 'bg-slate-900 text-white ring-slate-900'
      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
  }`
}

function buildHref(
  base: { year: number; month: number; category?: string; site?: string },
  overrides: Partial<{ year: number; month: number; category?: string; site?: string }>,
) {
  const params = new URLSearchParams()
  const merged = { ...base, ...overrides }
  params.set('year', String(merged.year))
  params.set('month', String(merged.month))
  if (merged.category) params.set('category', merged.category)
  if (merged.site) params.set('site', merged.site)
  return `/leave/calendar?${params.toString()}`
}

export default async function LeaveCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; category?: string; site?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year) || now.getUTCFullYear()
  const month = Number(params.month) || now.getUTCMonth() + 1
  const category = params.category
  const site = params.site

  const allEntries = await loadLeaveCalendar({ year, month })

  const sites = [...new Set(allEntries.map((e) => e.siteName).filter(Boolean))] as string[]

  const entries = allEntries.filter((e) => {
    if (category && e.category !== category) return false
    if (site && e.siteName !== site) return false
    return true
  })

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))
  const leadingBlanks = monthStart.getUTCDay()
  const totalDays = monthEnd.getUTCDate()

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function entriesOnDay(day: number) {
    const date = new Date(Date.UTC(year, month - 1, day))
    return entries.filter((e) => date >= e.startDate && date <= e.endDate)
  }

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leave" className="text-sm text-slate-500 hover:text-slate-900">
          ← Leave
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {monthLabel(year, month)}
          </h1>
          <div className="flex gap-2">
            <Link
              href={buildHref({ year, month, category, site }, prevMonth)}
              className={pillClass(false)}
            >
              ← Prev
            </Link>
            <Link
              href={buildHref({ year, month, category, site }, nextMonth)}
              className={pillClass(false)}
            >
              Next →
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={buildHref({ year, month, site }, {})} className={pillClass(!category)}>
            All
          </Link>
          {EMPLOYEE_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={buildHref({ year, month, category: c, site }, {})}
              className={pillClass(category === c)}
            >
              {EMPLOYEE_CATEGORY_LABELS[c as EmployeeCategory]}
            </Link>
          ))}
        </div>
      </div>

      {sites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Site</p>
          <div className="flex flex-wrap gap-2">
            <Link href={buildHref({ year, month, category }, {})} className={pillClass(!site)}>
              All
            </Link>
            {sites.map((s) => (
              <Link
                key={s}
                href={buildHref({ year, month, category, site: s }, {})}
                className={pillClass(site === s)}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="bg-slate-50 px-2 py-1.5 text-center text-xs font-medium text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="min-h-[90px] bg-white p-1.5">
            {day && (
              <>
                <div className="text-xs text-slate-400">{day}</div>
                <ul className="mt-1 space-y-0.5">
                  {entriesOnDay(day).map((entry) => (
                    <li key={entry.id}>
                      <Link
                        href={`/leave/${entry.id}`}
                        className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] hover:bg-slate-50"
                        title={`${entry.employeeName} — ${LEAVE_TYPE_LABELS[entry.leaveType]}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${LEAVE_TYPE_DOT[entry.leaveType]} ${
                            entry.status !== 'APPROVED' ? 'opacity-40' : ''
                          }`}
                        />
                        <span className={entry.status !== 'APPROVED' ? 'text-slate-400' : 'text-slate-700'}>
                          {entry.employeeName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
