import type { ProfileCompleteness } from '@/lib/document-completeness'

/** Same red/amber/green convention as everywhere else — not because a gap
 * here is a compliance problem the way an expired document is, but because
 * inventing a second colour language for "mostly missing" vs "missing" would
 * just make the page harder to read at a glance. */
function tone(percent: number) {
  if (percent >= 100) return 'complete'
  if (percent >= 50) return 'partial'
  return 'incomplete'
}

const BAR_CLASSES: Record<string, string> = {
  complete: 'bg-green-500',
  partial: 'bg-amber-500',
  incomplete: 'bg-red-500',
}

const TEXT_CLASSES: Record<string, string> = {
  complete: 'text-green-700',
  partial: 'text-amber-700',
  incomplete: 'text-red-700',
}

/** Compact version for a list row — just the percentage and a thin bar,
 * no room for the remaining-items list there. */
export function CompletenessBadge({
  completeness,
}: {
  completeness: ProfileCompleteness
}) {
  const state = tone(completeness.percent)

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${BAR_CLASSES[state]}`}
          style={{ width: `${completeness.percent}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${TEXT_CLASSES[state]}`}>
        {completeness.percent}%
      </span>
    </div>
  )
}

/** Full version for a detail page — bar, percentage, and exactly what's
 * still outstanding so staff can act on it immediately. */
export function CompletenessCard({
  completeness,
}: {
  completeness: ProfileCompleteness
}) {
  const state = tone(completeness.percent)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold">Profile completeness</h2>
        <span className={`text-sm font-semibold ${TEXT_CLASSES[state]}`}>
          {completeness.percent}%
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        {completeness.addressed} of {completeness.total} document{completeness.total === 1 ? '' : 's'} addressed
        {completeness.remaining.length === 0 ? '' : ' — the rest is real gaps, not just expiry'}
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-[width] ${BAR_CLASSES[state]}`}
          style={{ width: `${completeness.percent}%` }}
        />
      </div>

      {completeness.remaining.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Still missing
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {completeness.remaining.map((item) => (
              <li
                key={item}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
