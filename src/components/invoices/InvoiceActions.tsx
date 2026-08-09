'use client'

import { useActionState, useState } from 'react'
import { toDateInputValue } from '@/lib/dates'
import {
  deleteDraft,
  issueInvoice,
  markPaid,
  markUnpaid,
  updateDraft,
} from '@/lib/actions/invoices'
import type { InvoiceState } from '@/lib/invoice-status'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
} from '@/components/ui/form'

/**
 * The draft → issued → paid lifecycle.
 *
 * Only a draft is editable or deletable. Issuing is the point of no return:
 * from then on the invoice is a record of what was claimed on a date, and the
 * line items already carry their own figures so later edits to an assignment
 * cannot reach back and change it.
 */
export function InvoiceActions({
  invoiceId,
  state,
  invoiceNumber,
  dueDate,
}: {
  invoiceId: string
  state: InvoiceState
  invoiceNumber: string
  dueDate: Date | null
}) {
  const [editState, editAction, editing] = useActionState(
    updateDraft.bind(null, invoiceId),
    {},
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const errors = editState.errors ?? {}

  if (state === 'DRAFT') {
    return (
      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">Draft</h2>
          <p className="mt-1 text-sm text-slate-500">
            Set the number and due date, then issue. The number is suggested as
            the next in sequence — change it to match the pad if you need to.
          </p>
        </div>

        <form action={editAction} className="space-y-4">
          <FormError message={errors.form} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice number" htmlFor="invoiceNumber">
              <input
                id="invoiceNumber"
                name="invoiceNumber"
                defaultValue={invoiceNumber}
                className={inputClass}
              />
              {errors.invoiceNumber && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.invoiceNumber}
                </p>
              )}
            </Field>

            <Field label="Due date" htmlFor="dueDate">
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={toDateInputValue(dueDate)}
                className={inputClass}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={editing}
            className={buttonSecondaryClass}
          >
            {editing ? 'Saving…' : 'Save draft'}
          </button>
        </form>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <form action={issueInvoice.bind(null, invoiceId)}>
            <button type="submit" className={buttonPrimaryClass}>
              Issue invoice
            </button>
          </form>

          {confirmingDelete ? (
            <form action={deleteDraft.bind(null, invoiceId)}>
              <button
                type="submit"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Confirm delete
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className={buttonSecondaryClass}
            >
              Delete draft
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Issuing freezes the figures. After that the invoice can be marked paid
          but not edited or deleted.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-6">
      {state === 'PAID' ? (
        <>
          <p className="text-sm text-slate-600">
            Recorded as paid. Reopen it only if the payment was logged against
            the wrong invoice.
          </p>
          <form action={markUnpaid.bind(null, invoiceId)}>
            <button type="submit" className={buttonSecondaryClass}>
              Mark unpaid
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Issued and frozen. Editing an assignment now will not change it.
          </p>
          <form action={markPaid.bind(null, invoiceId)}>
            <button type="submit" className={buttonPrimaryClass}>
              Mark paid
            </button>
          </form>
        </>
      )}
    </section>
  )
}
