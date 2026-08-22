import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { todayUtc } from '@/lib/dates'
import { Sidebar, type SidebarCounts } from '@/components/shell/Sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mecon Operations',
  description: 'Equipment rental and contracting operations',
}

/**
 * The sidebar's nav-item pills — cheap, single-table COUNT queries only.
 * Nothing here joins or aggregates across tables; if a future count needs
 * that, it belongs on its own list page, not in the shell that renders on
 * every request. See NOTES.md's "App shell" section.
 */
async function loadSidebarCounts(): Promise<SidebarCounts> {
  const today = todayUtc()

  const [pendingOperatorTimesheets, pendingEquipmentTimesheets, pendingLeave, activeContracts] =
    await Promise.all([
      db.operatorTimesheet.count({ where: { status: 'DRAFT' } }),
      db.equipmentTimesheet.count({ where: { status: 'DRAFT' } }),
      db.leaveRequest.count({ where: { status: 'PENDING' } }),
      db.contract.count({
        where: {
          mobilizationDate: { lte: today },
          OR: [{ closingDate: null }, { closingDate: { gte: today } }],
        },
      }),
    ])

  return {
    pendingTimesheets: pendingOperatorTimesheets + pendingEquipmentTimesheets,
    pendingLeave,
    activeContracts,
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const counts = user ? await loadSidebarCounts() : null

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-white text-slate-900">
        {user && counts ? (
          <div className="md:flex">
            <Sidebar user={user} counts={counts} />
            <main className="min-w-0 flex-1">
              <div className="mx-auto max-w-[1120px] px-6 py-2 md:px-10">{children}</div>
            </main>
          </div>
        ) : (
          <main className="mx-auto max-w-[1120px] px-6 py-10 md:px-10">{children}</main>
        )}
      </body>
    </html>
  )
}
