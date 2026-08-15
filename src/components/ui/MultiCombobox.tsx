'use client'

import { useEffect, useRef, useState } from 'react'
import type { ComboboxOption } from './Combobox'

/**
 * Pick several values, free-text-with-suggestions, each submitted as its own
 * form value under the same name — read server-side with
 * `formData.getAll(name)`.
 *
 * First multi-value picker in the app; everything else (Select, Combobox) is
 * single-value. Built for Phase B2's "machines qualified to operate," which
 * is a genuine multi-select against an open-ended, suggestion-backed list
 * (equipment type) — a checkbox list like `approvedFor` would not fit, since
 * equipment type is deliberately not a closed set.
 *
 * NOT built on top of Combobox, despite the overlap — Combobox's allowCustom
 * calls onSelect on every keystroke (correct for a single field where the
 * typed text IS the live value), which would add a new chip after the first
 * character typed here. This needs a discrete commit — Enter, or clicking a
 * suggestion — so it has its own small input/dropdown instead.
 */
export function MultiCombobox({
  name,
  options,
  defaultValues = [],
  placeholder = 'Type to add…',
}: {
  name: string
  options: ComboboxOption[]
  defaultValues?: string[]
  placeholder?: string
}) {
  const [selected, setSelected] = useState<string[]>(defaultValues)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)

  const remaining = options.filter(
    (option) => !selected.some((value) => value.toLowerCase() === option.value.toLowerCase()),
  )
  const filtered = query.trim()
    ? remaining.filter((option) =>
        option.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : remaining

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function add(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return

    setSelected((current) =>
      current.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())
        ? current
        : [...current, trimmed],
    )
    setQuery('')
    setOpen(false)
    setHighlighted(0)
  }

  function remove(value: string) {
    setSelected((current) => current.filter((existing) => existing !== value))
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlighted((current) => {
        if (filtered.length === 0) return 0
        return (current + step + filtered.length) % filtered.length
      })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault() // never submit the outer form from this field
      const match = filtered[highlighted]
      if (match) add(match.value)
      else if (query.trim()) add(query) // no suggestion matched — add as typed
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <li
              key={value}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-sm text-slate-800"
            >
              {value}
              <button
                type="button"
                onClick={() => remove(value)}
                aria-label={`Remove ${value}`}
                className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlighted(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />

        {open && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.map((option, index) => (
              <li key={option.value}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => add(option.value)}
                  className={`block w-full truncate px-3 py-2 text-left text-sm text-slate-700 ${
                    index === highlighted ? 'bg-slate-100' : ''
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Press Enter to add — anything typed can be added, not only a
        suggestion.
      </p>
    </div>
  )
}
