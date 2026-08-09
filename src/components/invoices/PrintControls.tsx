'use client'

import Link from 'next/link'
import { useState } from 'react'
import { buttonPrimaryClass, buttonSecondaryClass } from '@/components/ui/form'

/**
 * On-screen controls for the print page. Never printed themselves.
 *
 * The letterhead toggle exists because the company has pre-printed pads: when
 * printing onto those, the letterhead and footer must be suppressed or they
 * double-print over the stationery. On blank paper everything prints.
 */
export function PrintControls() {
  const [withLetterhead, setWithLetterhead] = useState(true)

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .invoice-sheet { max-width: none; padding: 0; }
          @page { size: A4; margin: 12mm; }
        }
        .hide-letterhead .letterhead { visibility: hidden; }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-3 px-2">
        <Link href=".." className={buttonSecondaryClass}>
          ← Back
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className={buttonPrimaryClass}
        >
          Print
        </button>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={withLetterhead}
            onChange={(event) => {
              setWithLetterhead(event.target.checked)
              document.body.classList.toggle(
                'hide-letterhead',
                !event.target.checked,
              )
            }}
            className="h-4 w-4 rounded border-slate-300"
          />
          Print letterhead
        </label>

        <span className="text-xs text-slate-500">
          Untick when printing onto the pre-printed pads, so the letterhead does
          not print twice.
        </span>
      </div>
    </>
  )
}
