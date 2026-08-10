import { db } from './db'
import { EQUIPMENT_TYPE_SUGGESTIONS } from './enums'

/**
 * Equipment types to suggest: the starting list plus every type already in
 * use, so the vocabulary grows with the fleet instead of being fixed by me.
 * Nothing here constrains what can be entered — see enums.ts.
 */
export async function loadEquipmentTypeOptions(): Promise<
  { value: string; label: string }[]
> {
  const rows = await db.equipment.findMany({
    select: { type: true },
    distinct: ['type'],
    orderBy: { type: 'asc' },
  })

  const seen = new Map<string, string>()

  for (const type of [...EQUIPMENT_TYPE_SUGGESTIONS, ...rows.map((r) => r.type)]) {
    const trimmed = type.trim()
    if (!trimmed) continue
    // Case-insensitive so "boom truck" and "Boom Truck" are not offered twice.
    if (!seen.has(trimmed.toLowerCase())) seen.set(trimmed.toLowerCase(), trimmed)
  }

  return [...seen.values()]
    .sort((a, b) => a.localeCompare(b))
    .map((type) => ({ value: type, label: type }))
}
