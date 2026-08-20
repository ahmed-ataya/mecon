'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buttonPrimaryClass, buttonSecondaryClass } from '@/components/ui/form'

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

  function handleClick() {
    if (
      finalized &&
      !confirm('Unfinalize this payroll period? Payslips can be edited again once unfinalized.')
    ) {
      return
    }

    startTransition(async () => {
      await (finalized ? unfinalizeAction() : finalizeAction())
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={finalized ? buttonSecondaryClass : buttonPrimaryClass}
    >
      {isPending ? 'Working…' : finalized ? 'Unfinalize' : 'Finalize'}
    </button>
  )
}
