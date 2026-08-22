'use client'

import { useActionState, useState } from 'react'
import type { DecideActionState } from '@/lib/actions/leave'
import { FormError, buttonPrimaryClass, buttonSecondaryClass, inputClass } from '@/components/ui/form'

/**
 * Approve/reject a leave request — a status field only, not a real
 * approval trail (no user-account system exists yet). Whoever is at the
 * keyboard types their own name; see LeaveRequest's model comment.
 */
export function DecisionForm({
  approveAction,
  rejectAction,
}: {
  approveAction: (
    state: DecideActionState,
    formData: FormData,
  ) => Promise<DecideActionState>
  rejectAction: (
    state: DecideActionState,
    formData: FormData,
  ) => Promise<DecideActionState>
}) {
  const [decidedBy, setDecidedBy] = useState('')
  const [approveState, approveFormAction, approvePending] = useActionState(
    approveAction,
    {},
  )
  const [rejectState, rejectFormAction, rejectPending] = useActionState(
    rejectAction,
    {},
  )

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Decide this request</h2>
      <FormError message={approveState.errors?.form ?? rejectState.errors?.form} />

      <label htmlFor="decidedBy" className="block text-sm font-medium text-slate-700">
        Decided by
      </label>
      <input
        id="decidedByShared"
        value={decidedBy}
        onChange={(event) => setDecidedBy(event.target.value)}
        placeholder="Name of whoever is deciding"
        className={inputClass}
      />

      <div className="flex gap-3">
        <form action={approveFormAction}>
          <input type="hidden" name="decidedBy" value={decidedBy} />
          <button
            type="submit"
            disabled={approvePending || rejectPending}
            className={buttonPrimaryClass}
          >
            {approvePending ? 'Approving…' : 'Approve'}
          </button>
        </form>
        <form action={rejectFormAction}>
          <input type="hidden" name="decidedBy" value={decidedBy} />
          <button
            type="submit"
            disabled={approvePending || rejectPending}
            className={buttonSecondaryClass}
          >
            {rejectPending ? 'Rejecting…' : 'Reject'}
          </button>
        </form>
      </div>
    </div>
  )
}
