'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type SelectOption = {
  value: string
  label: string
}

/**
 * A closed-list picker that behaves like `<select>` for the form it submits
 * to, but never opens the operating system's native option popup.
 *
 * The native popup is what broke: driven with real clicks and keyboard input
 * (not synthetic DOM events — those had given false confidence earlier),
 * opening a plain `<select>` and picking an option sometimes never committed
 * the value. `Combobox` never had this problem, because it renders its own
 * option list IN THE PAGE rather than relying on that native popup. This
 * component is the same technique with the search box removed, for the short
 * closed lists across the app — arrangement, site regime, rate type,
 * mobilization charge, document type, capacity unit, assignment reason.
 *
 * The submitted value lives in a hidden input, re-applied after every commit
 * for the same reason Combobox does it: React resets a form's uncontrolled
 * fields after a server action completes, snapping back to the ORIGINAL
 * markup rather than what was picked. See NOTES.md.
 */
export function Select({
  name,
  options,
  defaultValue = '',
  placeholder = 'Select…',
  disabled = false,
  onSelect,
}: {
  name: string
  options: SelectOption[]
  defaultValue?: string
  /** Shown when nothing is selected — the blank "follow the rule" slot. */
  placeholder?: string
  disabled?: boolean
  onSelect?: (value: string) => void
}) {
  const [selected, setSelected] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  // Opens downward unless there is not enough room below the trigger — a
  // list opened near the bottom of a long page must not extend past the
  // viewport, which a native select avoids by flipping automatically.
  const [openUpward, setOpenUpward] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const hiddenRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()

  const selectedIndex = options.findIndex((option) => option.value === selected)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

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

  // A rough estimate is enough here — this only decides which side to open
  // on, not the list's actual height, which CSS still bounds and scrolls.
  const ESTIMATED_LIST_HEIGHT = Math.min(options.length * 36 + 8, 264)

  function openAt(index: number) {
    const trigger = triggerRef.current?.getBoundingClientRect()
    if (trigger) {
      const spaceBelow = window.innerHeight - trigger.bottom
      setOpenUpward(
        spaceBelow < ESTIMATED_LIST_HEIGHT && trigger.top > spaceBelow,
      )
    }
    setOpen(true)
    setHighlighted(index >= 0 ? index : 0)
  }

  function choose(option: SelectOption) {
    setSelected(option.value)
    setOpen(false)
    onSelect?.(option.value)
    // Native selects return focus to the control after picking, not to
    // whatever was under the cursor — matched here so Tab moves on correctly.
    triggerRef.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openAt(selectedIndex)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlighted((current) => {
        if (options.length === 0) return 0
        return (current + step + options.length) % options.length
      })
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        openAt(selectedIndex)
        return
      }
      const option = options[highlighted]
      if (option) choose(option)
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    // Type-ahead: jump to the next option starting with the typed letter,
    // matching how a native select behaves.
    if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
      const letter = event.key.toLowerCase()
      const from = open ? highlighted + 1 : 0
      const match = options.findIndex(
        (option, index) =>
          (index >= from || from === 0) &&
          option.label.toLowerCase().startsWith(letter),
      )
      const wrapped =
        match === -1
          ? options.findIndex((option) => option.label.toLowerCase().startsWith(letter))
          : match

      if (wrapped >= 0) {
        if (open) {
          setHighlighted(wrapped)
        } else {
          choose(options[wrapped])
        }
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={selected} />

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (open) setOpen(false)
          else openAt(selectedIndex)
        }}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <span className={`truncate ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0 text-slate-400"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className={`absolute z-20 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === selected}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(option)}
                className={`block w-full truncate px-3 py-2 text-left text-sm ${
                  index === highlighted ? 'bg-slate-100' : ''
                } ${option.value === selected ? 'font-medium text-slate-900' : 'text-slate-700'}`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
