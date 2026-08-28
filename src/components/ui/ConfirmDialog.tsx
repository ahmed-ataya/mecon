'use client'

import { useCallback, useEffect, useState } from 'react'
import { buttonPrimaryClass, buttonSecondaryClass } from './form'

type ConfirmState = {
  message: string
  resolve: (value: boolean) => void
}

/**
 * Drop-in async replacement for `window.confirm()` — same "await the
 * answer" shape (`if (!(await confirm(...))) return`), so swapping it in
 * doesn't change the surrounding control flow. Styled to match the rest of
 * the app instead of the browser's own dialog. Each caller holds its own
 * instance, not a global singleton — mount the returned `dialog` once
 * inside the component that calls `confirm`.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve })
    })
  }, [])

  function respond(value: boolean) {
    state?.resolve(value)
    setState(null)
  }

  const dialog = state ? (
    <ConfirmModal message={state.message} onCancel={() => respond(false)} onConfirm={() => respond(true)} />
  ) : null

  return { confirm, dialog }
}

function ConfirmModal({
  message,
  onCancel,
  onConfirm,
}: {
  message: string
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      >
        <p className="text-sm text-slate-700">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={buttonSecondaryClass}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={buttonPrimaryClass} autoFocus>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
