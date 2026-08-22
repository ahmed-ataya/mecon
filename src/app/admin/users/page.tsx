import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { USER_ROLE_LABELS, type UserRole } from '@/lib/enums'
import { deleteUser } from '@/lib/actions/users'
import { buttonPrimaryClass } from '@/components/ui/form'

export default async function UsersPage() {
  const currentUser = await requireAdminPage()
  const users = await db.user.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-slate-500">
            {users.length} account{users.length === 1 ? '' : 's'}. Admin only.
          </p>
        </div>
        <Link href="/admin/users/new" className={buttonPrimaryClass}>
          Add user
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-slate-900">
                  {user.name}
                  {user.id === currentUser.id && (
                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {USER_ROLE_LABELS[user.role as UserRole] ?? user.role}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}/edit`}
                    className="text-slate-600 hover:underline"
                  >
                    Edit
                  </Link>
                  {user.id !== currentUser.id && (
                    <form
                      action={deleteUser.bind(null, user.id)}
                      className="ml-3 inline"
                    >
                      <button type="submit" className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
