import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { EquipmentForm } from '@/components/equipment/EquipmentForm'
import { updateEquipment } from '@/lib/actions/equipment'
import { loadEquipmentTypeOptions } from '@/lib/equipment-options'

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [equipment, typeSuggestions] = await Promise.all([
    db.equipment.findUnique({ where: { id } }),
    loadEquipmentTypeOptions(),
  ])

  if (!equipment) notFound()

  // Bind the id so the shared form keeps the same (state, formData) shape.
  const action = updateEquipment.bind(null, id)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={`/equipment/${id}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← {equipment.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit equipment
        </h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <EquipmentForm
          action={action}
          equipment={equipment}
          typeSuggestions={typeSuggestions}
          submitLabel="Save changes"
          cancelHref={`/equipment/${id}`}
        />
      </div>
    </div>
  )
}
