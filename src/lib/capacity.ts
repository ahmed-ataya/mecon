import { CAPACITY_UNIT_LABELS, type CapacityUnit } from './enums'

/**
 * Capacity is stored as a number plus a unit rather than as text, so a
 * ten-tonne machine can actually be found by searching for one.
 *
 * The value is a Float: half-tonnes are normal across the fleet (8.5, 9.2,
 * 10.2). This is a specification rather than money, so binary-float rounding
 * is not a concern the way it is in money.ts.
 */
export function formatCapacity(
  value: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (value === null || value === undefined) return '—'

  const label = CAPACITY_UNIT_LABELS[unit as CapacityUnit] ?? unit ?? ''

  // 8.5 stays "8.5", 10 becomes "10" rather than "10.0".
  return `${Number(value)} ${label}`.trim()
}

/** Parse a typed capacity, allowing blank. Returns undefined if unparseable. */
export function parseCapacity(
  value: FormDataEntryValue | null,
): number | null | undefined {
  if (value === null) return null

  const raw = String(value).trim()
  if (!raw) return null

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined

  return parsed
}
