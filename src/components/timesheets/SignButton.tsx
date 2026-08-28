'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buttonPrimaryClass, buttonSecondaryClass } from '@/components/ui/form'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

/**
 * The signature is what makes a timesheet usable downstream — signing locks
 * the daily rows (DailyRowsTable disables its inputs once status is
 * SIGNED). Unsigning is deliberately just as easy, since a mistake found
 * after signing shouldn't need a delete-and-recreate.
 */
export function SignButton({
  signed,
  signAction,
  unsignAction,
}: {
  signed: boolean
  signAction: () => Promise<void>
  unsignAction: () => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { confirm, dialog } = useConfirmDialog()

  async function handleClick() {
    if (signed && !(await confirm('Unsign this timesheet? It can be edited again once unsigned.'))) {
      return
    }

    startTransition(async () => {
      await (signed ? unsignAction() : signAction())
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={signed ? buttonSecondaryClass : buttonPrimaryClass}
      >
        {isPending ? 'Working…' : signed ? 'Unsign' : 'Mark signed'}
      </button>
      {dialog}
    </>
  )
}
