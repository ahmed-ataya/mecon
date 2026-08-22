import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/guard'
import { createUser } from '@/lib/actions/users'
import { UserForm } from '@/components/admin/UserForm'

export default async function NewUserPage() {
  await requireAdminPage()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-900">
          ← Users
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add user</h1>
      </div>

      <UserForm action={createUser} submitLabel="Add user" cancelHref="/admin/users" />
    </div>
  )
}
