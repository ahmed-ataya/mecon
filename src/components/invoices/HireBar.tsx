'use client'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * A machine's hire drawn to scale, so "when did this work and what is left to
 * bill" is answered by looking rather than by opening the contract.
 *
 * Every bar on a screen shares one range, so two machines can be compared by
 * eye — a bar that starts further right started later.
 *
 * Colour carries the meaning:
 *   slate  — on hire and already invoiced
 *   green  — on hire, not yet billed
 *   red    — off hire, not billable at all
 *   band   — the period currently selected for this invoice
 */
export type HireBarProps = {
  rangeStart: Date
  rangeEnd: Date
  workedFrom: Date | null
  workedTo: Date | null
  invoicedThrough: Date | null
  offHire: { startDate: Date; endDate: Date | null }[]
  periodStart: Date | null
  periodEnd: Date | null
}

function pct(from: Date, to: Date, rangeStart: Date, totalDays: number): {
  left: number
  width: number
} {
  const startOffset = (from.getTime() - rangeStart.getTime()) / MS_PER_DAY
  const days = (to.getTime() - from.getTime()) / MS_PER_DAY + 1

  return {
    left: Math.max(0, (startOffset / totalDays) * 100),
    width: Math.max(0.6, (days / totalDays) * 100),
  }
}

export function HireBar({
  rangeStart,
  rangeEnd,
  workedFrom,
  workedTo,
  invoicedThrough,
  offHire,
  periodStart,
  periodEnd,
}: HireBarProps) {
  const totalDays =
    (rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY + 1

  if (!workedFrom) {
    return (
      <div className="relative h-5 w-full rounded bg-slate-100 ring-1 ring-inset ring-slate-200" />
    )
  }

  // An open hire is drawn to the end of the range rather than trailing off, so
  // "still running" reads as a bar that reaches the edge.
  const end = workedTo ?? rangeEnd

  const hire = pct(workedFrom, end, rangeStart, totalDays)

  // The invoiced part stops at whichever comes first: the last billed day or
  // the end of hire.
  const billedTo =
    invoicedThrough && invoicedThrough < end ? invoicedThrough : end
  const billed =
    invoicedThrough && invoicedThrough >= workedFrom
      ? pct(workedFrom, billedTo, rangeStart, totalDays)
      : null

  const selected =
    periodStart && periodEnd && periodEnd >= periodStart
      ? pct(periodStart, periodEnd, rangeStart, totalDays)
      : null

  return (
    <div className="relative h-5 w-full overflow-hidden rounded bg-slate-100 ring-1 ring-inset ring-slate-200">
      {/* Whole hire — green means nothing billed here yet. */}
      <div
        className="absolute inset-y-0 rounded-sm bg-green-400"
        style={{ left: `${hire.left}%`, width: `${hire.width}%` }}
      />

      {/* Already invoiced, drawn over the green. */}
      {billed && (
        <div
          className="absolute inset-y-0 rounded-sm bg-slate-400"
          style={{ left: `${billed.left}%`, width: `${billed.width}%` }}
        />
      )}

      {/* Off hire is never billable, so it overrides both. */}
      {offHire.map((period, index) => {
        const stop = period.endDate ?? end
        if (stop < workedFrom || period.startDate > end) return null

        const bar = pct(
          period.startDate < workedFrom ? workedFrom : period.startDate,
          stop > end ? end : stop,
          rangeStart,
          totalDays,
        )

        return (
          <div
            key={index}
            className="absolute inset-y-0 bg-red-400"
            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
          />
        )
      })}

      {/* What this invoice will cover. */}
      {selected && (
        <div
          className="absolute inset-y-0 border-x-2 border-slate-900 bg-slate-900/10"
          style={{ left: `${selected.left}%`, width: `${selected.width}%` }}
        />
      )}
    </div>
  )
}

/** Month labels above the bars, on the same scale. */
export function HireScale({
  rangeStart,
  rangeEnd,
}: {
  rangeStart: Date
  rangeEnd: Date
}) {
  const totalDays =
    (rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY + 1

  const months: { label: string; left: number }[] = []
  const cursor = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1),
  )

  while (cursor.getTime() <= rangeEnd.getTime()) {
    const offset = (cursor.getTime() - rangeStart.getTime()) / MS_PER_DAY

    if (offset >= 0) {
      months.push({
        label: cursor.toLocaleDateString('en-GB', {
          month: 'short',
          timeZone: 'UTC',
        }),
        left: (offset / totalDays) * 100,
      })
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return (
    <div className="relative h-4 w-full text-[10px] text-slate-400">
      {months.map((month) => (
        <span
          key={month.label + month.left}
          className="absolute border-l border-slate-200 pl-1"
          style={{ left: `${month.left}%` }}
        >
          {month.label}
        </span>
      ))}
    </div>
  )
}
