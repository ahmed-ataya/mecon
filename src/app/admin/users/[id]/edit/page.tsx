import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth/guard'
import { db } from '@/lib/db'
import { updateUser } from '@/lib/actions/users'
import { UserForm } from '@/components/admin/UserForm'

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminPage()
  const { id } = await params
  const user = await db.user.findUnique({ where: { id } })

  if (!user) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-900">
          ← Users
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{user.name}</h1>
      </div>

      <UserForm
        action={updateUser.bind(null, user.id)}
        user={user}
        submitLabel="Save changes"
        cancelHref="/admin/users"
      />
    </div>
  )
}
