import { WARNING_CLASSES, worstSeverity, type Warning } from '@/lib/warnings'

/**
 * Warnings never block. They are shown so the decision is informed, not so the
 * system can refuse — the business sometimes proceeds knowingly, and a system
 * that says no just gets bypassed outside the system.
 */
export function WarningList({
  warnings,
  title = 'Warnings',
}: {
  warnings: Warning[]
  title?: string
}) {
  if (warnings.length === 0) return null

  const severity = worstSeverity(warnings)!

  return (
    <div
      className={`rounded-md px-4 py-3 text-sm ring-1 ring-inset ${WARNING_CLASSES[severity]}`}
    >
      <p className="font-medium">
        {title}
        <span className="ml-1 font-normal opacity-80">
          ({warnings.length})
        </span>
      </p>
      <ul className="mt-1.5 space-y-1">
        {warnings.map((warning, index) => (
          <li key={`${warning.code}-${index}`} className="flex gap-2">
            <span aria-hidden className="opacity-60">
              •
            </span>
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs opacity-75">
        These do not prevent saving — record the contract and resolve them
        separately.
      </p>
    </div>
  )
}
