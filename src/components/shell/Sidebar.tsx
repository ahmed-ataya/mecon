'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/actions/auth'
import { USER_ROLE_LABELS, type UserRole } from '@/lib/enums'
import {
  IconAudit,
  IconContract,
  IconCustomer,
  IconEmployee,
  IconEquipment,
  IconInvoice,
  IconLeave,
  IconLpo,
  IconMenu,
  IconPayroll,
  IconTimesheet,
  IconUsers,
} from './icons'

type NavItem = {
  href: string
  label: string
  icon: (props: { className?: string }) => React.ReactElement
  /** Key into `counts` — a small muted pill on the right, hidden at zero.
   * Only for counts that are cheap to compute (see layout.tsx) — never
   * add one that needs a heavy query. */
  countKey?: keyof SidebarCounts
}

type NavGroup = { label: string; items: NavItem[] }

export type SidebarCounts = {
  pendingTimesheets: number
  pendingLeave: number
  activeContracts: number
}

const OPERATIONS: NavItem[] = [
  { href: '/contracts', label: 'Contracts', icon: IconContract, countKey: 'activeContracts' },
  { href: '/lpos', label: 'LPOs', icon: IconLpo },
  { href: '/timesheets', label: 'Timesheets', icon: IconTimesheet, countKey: 'pendingTimesheets' },
  { href: '/invoices', label: 'Invoices', icon: IconInvoice },
]

const PEOPLE_BASE: NavItem[] = [
  { href: '/operators', label: 'Employees', icon: IconEmployee },
  { href: '/leave', label: 'Leave', icon: IconLeave, countKey: 'pendingLeave' },
]

const PAYROLL_ITEM: NavItem = { href: '/payroll', label: 'Payroll', icon: IconPayroll }

const YARD: NavItem[] = [
  { href: '/equipment', label: 'Equipment', icon: IconEquipment },
  { href: '/customers', label: 'Customers', icon: IconCustomer },
]

const ADMIN: NavItem[] = [
  { href: '/admin/users', label: 'Users', icon: IconUsers },
  { href: '/admin/audit', label: 'Audit log', icon: IconAudit },
]

/** A child route keeps its section active — /contracts/CT-0231 still
 * highlights Contracts. Exact match for the root paths that would
 * otherwise prefix-match everything (e.g. every operator's own detail
 * page lives under /operators, which must not also light up on
 * unrelated paths sharing that prefix by accident). */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({
  user,
  counts,
}: {
  user: { name: string; role: UserRole }
  counts: SidebarCounts
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // A navigation closes the mobile overlay — otherwise the next page loads
  // underneath a still-open sidebar. Adjusted during render (React's own
  // pattern for "state that resets when a prop changes") rather than an
  // effect, which would cause an extra visible render after the fact.
  const [trackedPathname, setTrackedPathname] = useState(pathname)
  if (pathname !== trackedPathname) {
    setTrackedPathname(pathname)
    setOpen(false)
  }

  const groups: NavGroup[] = [
    { label: 'Operations', items: OPERATIONS },
    { label: 'People', items: user.role === 'ADMIN' ? [...PEOPLE_BASE, PAYROLL_ITEM] : PEOPLE_BASE },
    { label: 'Yard', items: YARD },
    ...(user.role === 'ADMIN' ? [{ label: 'Admin', items: ADMIN }] : []),
  ]

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      {/* Mobile topbar — hidden at md and above, where the rail is always visible. */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
        >
          <IconMenu />
        </button>
        <span className="text-sm font-semibold tracking-tight">Mecon</span>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex h-screen w-[224px] shrink-0 flex-col border-r border-slate-200 bg-[#f6f6f4] pt-4 pb-3 transition-transform duration-150 ease-out md:sticky md:top-0 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link
          href="/"
          className="mb-5 flex items-center gap-2.5 px-[18px] text-[15px] font-semibold tracking-tight text-slate-900"
        >
          <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-slate-900 text-xs font-bold text-white">
            M
          </span>
          Mecon
        </Link>

        <nav className="flex-1 overflow-y-auto px-2.5">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-2 pb-1.5 font-mono text-[10px] tracking-[0.09em] text-slate-400 uppercase">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href)
                const count = item.countKey ? counts[item.countKey] : undefined
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`mb-px flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] ${
                      active
                        ? 'bg-[#e8e8e4] font-semibold text-slate-900'
                        : 'text-slate-600 hover:bg-[#f2f2ef] hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`h-[15px] w-[15px] shrink-0 stroke-current fill-none stroke-[1.6] ${active ? 'opacity-100' : 'opacity-70'}`} />
                    {item.label}
                    {!!count && (
                      <span
                        className={`ml-auto rounded-full px-1.5 py-px font-mono text-[10.5px] ${
                          active ? 'bg-[#dcdcd7] text-slate-600' : 'bg-[#e8e8e4] text-slate-500'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="mx-2.5 mt-2 border-t border-slate-200 pt-2.5">
          <div className="flex items-center gap-2.5 rounded-md p-1.5">
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#dcdcd7] text-[10.5px] font-semibold text-slate-600">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight text-slate-900">
                {user.name}
              </span>
              <span className="flex items-center gap-1 text-[11px] leading-tight text-slate-400">
                {USER_ROLE_LABELS[user.role]}
                <span aria-hidden="true">·</span>
                <form action={logout}>
                  <button type="submit" className="hover:text-slate-700 hover:underline">
                    Sign out
                  </button>
                </form>
              </span>
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
