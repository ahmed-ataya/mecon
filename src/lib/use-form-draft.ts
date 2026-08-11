'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

/**
 * Keeps an unfinished form in the browser so you can come back to it.
 *
 * Deliberately NOT a database record. A half-filled contract has no customer,
 * no machine and no rate, so storing it as a Contract would mean making those
 * columns optional — and then every calculation downstream has to defend
 * against contracts that are not really contracts. The draft is a scratchpad,
 * not a record.
 *
 * The trade-off of living in the browser: it is per-device, and clearing site
 * data loses it. That is the right trade until phase 4 adds user accounts, at
 * which point a draft can belong to a person rather than a browser.
 */

export type Draft = {
  values: Record<string, string>
  savedAt: string
}

/** React's own form fields, which must never be restored. */
function isInternal(name: string): boolean {
  return name.startsWith('$')
}

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state inside an effect.
 *
 * getSnapshot must return a STABLE reference while the underlying string is
 * unchanged — parsing afresh each call would hand React a new object every
 * render and spin forever. Hence the cache.
 */
const cache = new Map<string, { raw: string | null; draft: Draft | null }>()

function readDraft(storageKey: string): Draft | null {
  let raw: string | null = null

  try {
    raw = window.localStorage.getItem(storageKey)
  } catch {
    // Private browsing can throw on read. A missing scratchpad is not an error
    // worth showing anyone.
    return null
  }

  const cached = cache.get(storageKey)
  if (cached && cached.raw === raw) return cached.draft

  let draft: Draft | null = null
  try {
    const parsed = raw ? (JSON.parse(raw) as Draft) : null
    if (parsed?.values && Object.keys(parsed.values).length > 0) draft = parsed
  } catch {
    draft = null
  }

  cache.set(storageKey, { raw, draft })
  return draft
}

/** Fired on save/clear so every hook instance re-reads. */
const CHANGED_EVENT = 'mecon:draft-changed'

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED_EVENT, onChange)
  // Another tab editing the same draft counts too.
  window.addEventListener('storage', onChange)

  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useFormDraft(storageKey: string) {
  // The server renders "no draft" so hydration matches. Nudging the store once
  // after mount makes React re-read localStorage for real. This dispatches an
  // event rather than copying the store into state — the whole point of
  // useSyncExternalStore is that the store stays the single source.
  useEffect(() => {
    window.dispatchEvent(new Event(CHANGED_EVENT))
  }, [])

  const found = useSyncExternalStore(
    subscribe,
    () => readDraft(storageKey),
    // Nothing is stored on the server, so SSR and the first client render
    // agree on null and hydration stays clean.
    () => null,
  )

  const save = useCallback(
    (form: HTMLFormElement) => {
      const values: Record<string, string> = {}
      let meaningful = false

      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value !== 'string' || isInternal(key)) continue

        values[key] = value
        if (value.trim() !== '') meaningful = true
      }

      // An untouched form is not a draft. Without this, merely opening the
      // page would leave a "you have unfinished work" banner behind.
      if (!meaningful) return

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ values, savedAt: new Date().toISOString() }),
        )
        window.dispatchEvent(new Event(CHANGED_EVENT))
      } catch {
        // Private browsing and full storage both throw. Autosave is a
        // convenience; failing it must never block typing.
      }
    },
    [storageKey],
  )

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
      window.dispatchEvent(new Event(CHANGED_EVENT))
    } catch {
      // Ignored for the same reason as save.
    }
  }, [storageKey])

  return { found, save, clear }
}

/** "3 minutes ago", for telling someone how stale their draft is. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)

  if (seconds < 90) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
