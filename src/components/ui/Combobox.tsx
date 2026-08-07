'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  DOCUMENT_STATUS_CLASSES,
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from '@/lib/document-status'

export type ComboboxOption = {
  value: string
  label: string
  /** Secondary line — plate number, nationality, contact person. */
  sublabel?: string
  /**
   * Document status shown inline on the option, so a problem is visible
   * BEFORE the record is chosen rather than after.
   */
  status?: DocumentStatus
}

/**
 * Type-to-filter select. The customer list grows large, so a plain <select>
 * stops being usable.
 *
 * The submitted value lives in a hidden input. Like the document type select,
 * it is re-applied after every commit: React resets the form once an action
 * resolves, and a reset returns inputs to their default attribute — which
 * would silently submit a stale selection on the next attempt. See NOTES.md.
 */
export function Combobox({
  name,
  options,
  defaultValue = '',
  placeholder = 'Search…',
  emptyLabel = 'No matches',
  disabled = false,
  allowCustom = false,
  onSelect,
}: {
  name: string
  options: ComboboxOption[]
  defaultValue?: string
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  /**
   * Keep whatever is typed, even when it matches nothing. Used for locations:
   * a fixed list collapsed every unlisted site to "Other" and lost the real
   * name, so the list suggests without constraining.
   */
  allowCustom?: boolean
  onSelect?: (value: string) => void
}) {
  const [selected, setSelected] = useState(defaultValue)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const hiddenRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const selectedOption = options.find((option) => option.value === selected)

  // Once something is chosen, show its label rather than the search text.
  // With allowCustom the typed text IS the value, so fall back to it.
  const inputValue = open
    ? query
    : (selectedOption?.label ?? (allowCustom ? selected : ''))

  const filtered = open
    ? options.filter((option) =>
        `${option.label} ${option.sublabel ?? ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : options

  // Keep the hidden input in step with state — see the component note above.
  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = selected
  })

  // Close when focus moves outside; a click elsewhere means "leave it alone".
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(option: ComboboxOption) {
    setSelected(option.value)
    setQuery('')
    setOpen(false)
    onSelect?.(option.value)
  }

  /** Free-typed text becomes the value as-is, with nothing selected from the list. */
  function acceptTyped(text: string) {
    const trimmed = text.trim()
    setSelected(trimmed)
    onSelect?.(trimmed)
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

    if (event.key === 'Enter' && open) {
      event.preventDefault() // do not submit the form while picking
      const option = filtered[highlighted]
      if (option) {
        choose(option)
      } else if (allowCustom && query.trim()) {
        acceptTyped(query)
        setOpen(false)
      }
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={selected} />

      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={inputValue}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value)
          setHighlighted(0)
          if (!open) setOpen(true)
          if (allowCustom) acceptTyped(event.target.value)
        }}
        onBlur={() => {
          // Committing on blur means a typed location is kept even if the
          // user never touches the suggestion list.
          if (allowCustom && query.trim()) acceptTyped(query)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
      />

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">
              {allowCustom && query.trim()
                ? `Use “${query.trim()}” — new entry, saved with this contract`
                : emptyLabel}
            </li>
          ) : (
            filtered.map((option, index) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === selected}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                    index === highlighted ? 'bg-slate-100' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">
                      {option.label}
                    </span>
                    {option.sublabel && (
                      <span className="block truncate text-xs text-slate-500">
                        {option.sublabel}
                      </span>
                    )}
                  </span>

                  {option.status && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                        DOCUMENT_STATUS_CLASSES[option.status]
                      }`}
                    >
                      {DOCUMENT_STATUS_LABELS[option.status]}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
