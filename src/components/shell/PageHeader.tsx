import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The breadcrumb + h1 + optional description every page opens with — see
 * NOTES.md's "App shell" section for the convention (25px/660-weight h1,
 * a muted one-line crumb above it). `crumb` is the section name shown
 * before the current page ("Admin" for "Admin / Audit log"); pass an href
 * to make it a link back to that section's own list page.
 */
export function PageHeader({
  crumb,
  crumbHref,
  title,
  badge,
  description,
  actions,
}: {
  crumb?: string
  crumbHref?: string
  title: string
  /** A status pill inline with the title, e.g. contract status, invoice
   * state, document completeness — every detail page's own equivalent. */
  badge?: ReactNode
  /** Usually plain text, but some detail pages need a link inside it (e.g.
   * the customer name on a contract) — ReactNode covers both. */
  description?: ReactNode
  /** Buttons/links on the right, e.g. "New", "Export CSV". */
  actions?: ReactNode
}) {
  return (
    <div className="pb-5 pt-1">
      {crumb && (
        <div className="flex items-center gap-1.5 pb-1.5 text-xs text-slate-500">
          {crumbHref ? (
            <Link href={crumbHref} className="hover:text-slate-900 hover:underline">
              {crumb}
            </Link>
          ) : (
            <span>{crumb}</span>
          )}
          <span aria-hidden="true">/</span>
          <span>{title}</span>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[25px] font-[660] tracking-[-0.025em] text-slate-900">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1 max-w-[62ch] text-[13.5px] text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-3">{actions}</div>}
      </div>
    </div>
  )
}
