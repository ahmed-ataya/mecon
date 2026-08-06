'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Search box that keeps the query in the URL, so a filtered list can be
 * bookmarked, shared and survives a refresh. Every list view gets one.
 */
export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [value, setValue] = useState(searchParams.get('q') ?? '')

  // Debounce so we are not pushing a route on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }

      const next = params.toString()
      router.replace(next ? `${pathname}?${next}` : pathname)
    }, 250)

    return () => clearTimeout(timer)
    // searchParams is intentionally omitted — including it would re-fire this
    // effect from its own navigation and fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pathname, router])

  return (
    <input
      type="search"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
    />
  )
}
