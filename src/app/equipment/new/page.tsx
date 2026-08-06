import Link from 'next/link'
import { EquipmentForm } from '@/components/equipment/EquipmentForm'
import { createEquipment } from '@/lib/actions/equipment'

export default function NewEquipmentPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/equipment"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Equipment
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Add equipment
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Registration, insurance and 3rd party certificates can be added once
          the machine is saved.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <EquipmentForm
          action={createEquipment}
          submitLabel="Create equipment"
          cancelHref="/equipment"
        />
      </div>
    </div>
  )
}
