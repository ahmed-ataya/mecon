'use client'

import { useActionState, useState } from 'react'
import { formatQar, toRiyalInput } from '@/lib/money'
import { computePayslip } from '@/lib/payroll'
import type { UpdatePayslipActionState } from '@/lib/actions/payroll'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  inputClass,
} from '@/components/ui/form'

export type PayslipData = {
  basicSalary: number
  housingAllowance: number
  transportAllowance: number
  foodAllowance: number
  siteAllowance: number
  otherAllowance: number
  standardHours: number
  regularHours: number
  overtimeHours: number
  paidLeaveHours: number
  unpaidLeaveHours: number
  deductionsAmount: number
  deductionsNote: string | null
}

/** Live-recomputes the full breakdown as hours/deductions change, using the
 * exact same function the server uses to persist — what's on screen while
 * editing is never a different calculation from what gets saved. */
export function PayslipEditForm({
  payslip,
  action,
  readOnly,
}: {
  payslip: PayslipData
  action: (
    state: UpdatePayslipActionState,
    formData: FormData,
  ) => Promise<UpdatePayslipActionState>
  readOnly: boolean
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}

  const [regularHours, setRegularHours] = useState(payslip.regularHours)
  const [overtimeHours, setOvertimeHours] = useState(payslip.overtimeHours)
  const [paidLeaveHours, setPaidLeaveHours] = useState(payslip.paidLeaveHours)
  const [unpaidLeaveHours, setUnpaidLeaveHours] = useState(payslip.unpaidLeaveHours)
  const [deductionsRiyals, setDeductionsRiyals] = useState(
    toRiyalInput(payslip.deductionsAmount),
  )

  const deductionsAmount = Math.round((Number(deductionsRiyals) || 0) * 100)

  const calc = computePayslip({
    basicSalary: payslip.basicSalary,
    housingAllowance: payslip.housingAllowance,
    transportAllowance: payslip.transportAllowance,
    foodAllowance: payslip.foodAllowance,
    siteAllowance: payslip.siteAllowance,
    otherAllowance: payslip.otherAllowance,
    standardHours: payslip.standardHours,
    regularHours,
    overtimeHours,
    paidLeaveHours,
    unpaidLeaveHours,
    deductionsAmount,
  })

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={errors.form} />

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Hours</h2>

          <p className="text-xs text-slate-500">
            Standard for this month: {payslip.standardHours} hrs.
          </p>

          <Field label="Regular hours" htmlFor="regularHours">
            <input
              id="regularHours"
              name="regularHours"
              type="number"
              step="0.5"
              min="0"
              value={regularHours}
              disabled={readOnly}
              onChange={(event) => setRegularHours(Number(event.target.value) || 0)}
              className={inputClass}
            />
          </Field>

          <Field label="Overtime hours" htmlFor="overtimeHours">
            <input
              id="overtimeHours"
              name="overtimeHours"
              type="number"
              step="0.5"
              min="0"
              value={overtimeHours}
              disabled={readOnly}
              onChange={(event) => setOvertimeHours(Number(event.target.value) || 0)}
              className={inputClass}
            />
          </Field>

          {calc.shortfallHours > 0 && (
            <p className="text-xs text-amber-700">
              {calc.shortfallHours} hrs short of standard — deducted at the
              hourly rate below.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Paid leave hours"
              htmlFor="paidLeaveHours"
              hint="Approved leave that doesn't count against pay."
            >
              <input
                id="paidLeaveHours"
                name="paidLeaveHours"
                type="number"
                step="0.5"
                min="0"
                value={paidLeaveHours}
                disabled={readOnly}
                onChange={(event) => setPaidLeaveHours(Number(event.target.value) || 0)}
                className={inputClass}
              />
            </Field>

            <Field
              label="Unpaid leave hours"
              htmlFor="unpaidLeaveHours"
              hint="Deducted the same as a genuine gap."
            >
              <input
                id="unpaidLeaveHours"
                name="unpaidLeaveHours"
                type="number"
                step="0.5"
                min="0"
                value={unpaidLeaveHours}
                disabled={readOnly}
                onChange={(event) => setUnpaidLeaveHours(Number(event.target.value) || 0)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Deductions (QAR)"
            htmlFor="deductionsAmount"
            hint="Advances, loans, fines — a flat amount, not tracked as a balance."
          >
            <input
              id="deductionsAmount"
              name="deductionsAmount"
              inputMode="decimal"
              value={deductionsRiyals}
              disabled={readOnly}
              onChange={(event) => setDeductionsRiyals(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Deductions note" htmlFor="deductionsNote">
            <input
              id="deductionsNote"
              name="deductionsNote"
              defaultValue={payslip.deductionsNote ?? ''}
              disabled={readOnly}
              className={inputClass}
            />
          </Field>
        </section>

        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold">Breakdown</h2>

          <Row label="Basic salary" value={formatQar(payslip.basicSalary)} />
          <Row
            label="Shortfall deduction"
            value={`− ${formatQar(calc.shortfallDeduction)}`}
            muted={calc.shortfallDeduction === 0}
          />
          <Row
            label="Overtime pay (125%)"
            value={`+ ${formatQar(calc.overtimePay)}`}
            muted={calc.overtimePay === 0}
          />
          <Row label="Basic pay" value={formatQar(calc.basicPay)} bold />

          <div className="my-2 border-t border-slate-100" />

          <Row label="Housing allowance" value={formatQar(payslip.housingAllowance)} />
          <Row label="Transport allowance" value={formatQar(payslip.transportAllowance)} />
          <Row label="Food allowance" value={formatQar(payslip.foodAllowance)} />
          <Row label="Site allowance" value={formatQar(payslip.siteAllowance)} />
          <Row label="Other allowance" value={formatQar(payslip.otherAllowance)} />

          <div className="my-2 border-t border-slate-100" />

          <Row label="Gross pay" value={formatQar(calc.grossPay)} bold />
          <Row
            label="Deductions"
            value={`− ${formatQar(deductionsAmount)}`}
            muted={deductionsAmount === 0}
          />
          <Row label="Net pay" value={formatQar(calc.netPay)} bold large />
        </section>
      </div>

      {!readOnly && (
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </form>
  )
}

function Row({
  label,
  value,
  bold,
  large,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  large?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
      <span
        className={`${bold ? 'font-semibold' : ''} ${large ? 'text-base' : ''} ${
          muted ? 'text-slate-400' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
