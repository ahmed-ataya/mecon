import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { canManageUsers, canViewAudit, canViewPayroll } from '@/lib/permissions'
import { USER_ROLE_LABELS } from '@/lib/enums'
import { logout } from '@/lib/actions/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mecon Operations',
  description: 'Equipment rental and contracting operations',
}

// Links are added as each section ships, so the nav never points at a page
// that does not exist yet. Payroll is filtered separately below — Admin
// only, see src/lib/permissions.ts.
const NAV = [
  { href: '/contracts', label: 'Contracts' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/timesheets', label: 'Timesheets' },
  { href: '/leave', label: 'Leave' },
  { href: '/lpos', label: 'LPOs' },
  { href: '/customers', label: 'Customers' },
  { href: '/equipment', label: 'Equipment' },
  { href: '/operators', label: 'Employees' },
]

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-8 px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Mecon
            </Link>

            {user && (
              <>
                <nav className="flex flex-1 flex-wrap gap-6 text-sm">
                  {NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {canViewPayroll(user.role) && (
                    <Link
                      href="/payroll"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      Payroll
                    </Link>
                  )}
                  {canManageUsers(user.role) && (
                    <Link
                      href="/admin/users"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      Users
                    </Link>
                  )}
                  {canViewAudit(user.role) && (
                    <Link
                      href="/admin/audit"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      Audit log
                    </Link>
                  )}
                </nav>

                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>
                    {user.name}{' '}
                    <span className="text-xs text-slate-400">
                      ({USER_ROLE_LABELS[user.role]})
                    </span>
                  </span>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="text-slate-500 hover:text-slate-900 hover:underline"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
