'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buttonPrimaryClass, buttonSecondaryClass } from '@/components/ui/form'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

/** Same idea as timesheets' SignButton — finalizing locks every payslip in
 * the period (DailyRowsTable-style edit forms disable once locked). */
export function FinalizeButton({
  finalized,
  finalizeAction,
  unfinalizeAction,
}: {
  finalized: boolean
  finalizeAction: () => Promise<void>
  unfinalizeAction: () => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { confirm, dialog } = useConfirmDialog()

  async function handleClick() {
    if (
      finalized &&
      !(await confirm('Unfinalize this payroll period? Payslips can be edited again once unfinalized.'))
    ) {
      return
    }

    startTransition(async () => {
      await (finalized ? unfinalizeAction() : finalizeAction())
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={finalized ? buttonSecondaryClass : buttonPrimaryClass}
      >
        {isPending ? 'Working…' : finalized ? 'Unfinalize' : 'Finalize'}
      </button>
      {dialog}
    </>
  )
}
