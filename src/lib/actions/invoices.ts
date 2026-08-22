'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { buildProposal, splitIntoMonths, type ProposedLine } from '../billing'
import { parseDateInput, todayUtc } from '../dates'
import {
  formatSystemInvoiceNumber,
  nextSystemSequence,
} from '../invoice-number'
import { requireDelete, requireWrite } from '../auth/guard'
import { createdField, deletedField, diffField, fmt, type FieldChange, logAudit } from '../audit'

export type ActionState = {
  errors?: Record<string, string>
  values?: Record<string, string>
}

function readForm(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value
  }

  return values
}

/**
 * The next position in the system sequence — see src/lib/invoice-number.ts for
 * why system numbers lead with a 5 and pad numbers with a 1.
 *
 * Only ever a suggestion: the draft's number stays editable until issue, so an
 * invoice that has to match a pre-printed form can carry the pad's number
 * instead. The unique constraint is what actually prevents a clash.
 */
async function nextSequence(): Promise<number> {
  const invoices = await db.invoice.findMany({ select: { invoiceNumber: true } })

  return nextSystemSequence(invoices.map((invoice) => invoice.invoiceNumber))
}

export async function nextInvoiceNumber(): Promise<string> {
  return formatSystemInvoiceNumber(await nextSequence())
}

const contractInclude = {
  equipmentAssignments: {
    include: { equipment: true, offHirePeriods: true },
    orderBy: { startDate: 'asc' },
  },
  operatorAssignments: {
    include: { operator: true },
    orderBy: { startDate: 'asc' },
  },
} as const

/** Strips the fields that exist only to help the caller, not the database. */
function toLineData(line: ProposedLine) {
  return {
    kind: line.kind,
    description: line.description,
    uom: line.uom,
    quantity: line.quantity,
    unitRate: line.unitRate,
    amount: line.amount,
    equipmentAssignmentId: line.equipmentAssignmentId,
    periodStart: line.periodStart,
    periodEnd: line.periodEnd,
    hours: line.hours,
    hoursSource: line.hoursSource,
  }
}

/**
 * Creates one or more DRAFT invoices.
 *
 * Drafts rather than finished invoices on purpose: the proposal is a starting
 * point that the manager checks — rate-tier warnings, off-hire deductions and
 * mobilization all want a human decision before anything is issued.
 */
export async function createInvoices(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()
  const values = readForm(formData)

  const customerId = values.customerId ?? ''
  const contractIds = formData.getAll('contractIds').map(String).filter(Boolean)
  const start = parseDateInput(values.periodStart ?? '')
  const end = parseDateInput(values.periodEnd ?? '')

  const errors: Record<string, string> = {}
  if (!customerId) errors.customerId = 'Select a customer'
  if (contractIds.length === 0) errors.contractIds = 'Select at least one contract'
  if (!start) errors.periodStart = 'Period start is required'
  if (!end) errors.periodEnd = 'Period end is required'
  if (start && end && end < start) {
    errors.periodEnd = 'Period end cannot be before the start'
  }

  if (Object.keys(errors).length > 0) return { errors, values }

  // NONE               one invoice, one line per machine for the whole span
  // MONTHLY_LINES      one invoice, a line per calendar month
  // SEPARATE_INVOICES  an invoice per calendar month
  const periodSplit = values.periodSplit ?? 'NONE'
  const combine = formData.get('combine') !== null
  const includeMobilization = formData.get('includeMobilization') !== null
  const includeDemobilization = formData.get('includeDemobilization') !== null

  const contracts = await db.contract.findMany({
    where: { id: { in: contractIds } },
    include: contractInclude,
  })

  if (contracts.length === 0) {
    return { errors: { form: 'Those contracts no longer exist.' }, values }
  }

  // Contracts on one invoice must draw on the same LPO — the invoice records a
  // single "Your Order No." and cannot honestly show two.
  const lpoIds = [...new Set(contracts.map((contract) => contract.lpoId))]
  if (combine && lpoIds.length > 1) {
    return {
      errors: {
        combine:
          'Those contracts are on different LPOs, so they cannot share one invoice.',
      },
      values,
    }
  }

  const whole = { start: start!, end: end! }

  // Only SEPARATE_INVOICES multiplies the invoices. MONTHLY_LINES keeps one
  // invoice and splits it inside — which is how 16-30 Jun and 1-11 Jul come to
  // sit on a single invoice as two lines.
  const invoicePeriods =
    periodSplit === 'SEPARATE_INVOICES' ? splitIntoMonths(whole.start, whole.end) : [whole]

  // Grouped per invoice: either all contracts together, or one each.
  const groups = combine ? [contracts] : contracts.map((contract) => [contract])

  type Contracts = typeof contracts
  type Pending = {
    period: { start: Date; end: Date }
    group: Contracts
    lines: ProposedLine[]
  }

  const pending: Pending[] = []

  for (const period of invoicePeriods) {
    for (const group of groups) {
      const lines: ProposedLine[] = []

      for (const contract of group) {
        const linePeriods =
          periodSplit === 'MONTHLY_LINES'
            ? splitIntoMonths(period.start, period.end)
            : [period]

        for (const linePeriod of linePeriods) {
          const proposal = buildProposal({
            period: linePeriod,
            contract,
            equipmentAssignments: contract.equipmentAssignments,
            operatorAssignments: contract.operatorAssignments,
          })
          lines.push(...proposal.lines)
        }
      }

      // A period a contract was not running in produces nothing. Creating an
      // empty invoice would just be noise to delete later.
      if (lines.length === 0) continue

      pending.push({ period, group, lines })
    }
  }

  // Mobilization is charged ONCE per contract, however the span was split.
  // Attached after the hire lines are known, so that:
  //  - splitting into monthly invoices cannot charge for mobilizing again
  //    every month
  //  - both charges land on invoices that actually exist, rather than on a
  //    trailing month the contract had already closed in
  //  - the line prints below the hire lines, as the handwritten invoices read
  if (includeMobilization || includeDemobilization) {
    for (const contract of contracts) {
      const holding = pending.filter((entry) =>
        entry.group.some((member) => member.id === contract.id),
      )
      if (holding.length === 0) continue

      const first = holding[0]
      const last = holding[holding.length - 1]

      const charge = (
        target: Pending,
        wantsMob: boolean,
        wantsDemob: boolean,
      ) => {
        const proposal = buildProposal({
          period: target.period,
          contract,
          equipmentAssignments: [],
          operatorAssignments: [],
          mobilization: contract,
          includeMobilization: wantsMob,
          includeDemobilization: wantsDemob,
        })
        target.lines.push(...proposal.lines)
      }

      // Landing on the same invoice, they print as one combined line —
      // "Mobilization And Demobilization Charge" — which is what the real
      // invoices show for a short hire.
      if (includeMobilization && includeDemobilization && first === last) {
        charge(first, true, true)
      } else {
        if (includeMobilization) charge(first, true, false)
        if (includeDemobilization) charge(last, false, true)
      }
    }
  }

  let sequence = await nextSequence()
  const created: string[] = []

  for (const entry of pending) {
    const invoice = await db.invoice.create({
      data: {
        customerId,
        lpoId: entry.group[0].lpoId,
        invoiceNumber: formatSystemInvoiceNumber(sequence++),
        periodStart: entry.period.start,
        periodEnd: entry.period.end,
        totalAmount: entry.lines.reduce((sum, line) => sum + line.amount, 0),
        status: 'DRAFT',
        contracts: {
          create: entry.group.map((contract) => ({ contractId: contract.id })),
        },
        lineItems: { create: entry.lines.map(toLineData) },
      },
    })

    created.push(invoice.id)

    await logAudit({
      user,
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      changedFields: [
        createdField('Amount', invoice.totalAmount, fmt.money),
        createdField('Period start', invoice.periodStart, fmt.date),
        createdField('Period end', invoice.periodEnd, fmt.date),
      ],
    })
  }

  if (created.length === 0) {
    return {
      errors: {
        form: 'Nothing to bill — no machine or operator was on hire in that period.',
      },
      values,
    }
  }

  revalidatePath('/invoices')

  // One invoice opens straight to it; several go to the list.
  redirect(created.length === 1 ? `/invoices/${created[0]}` : '/invoices')
}

/** Editable only while a draft — see issueInvoice. */
export async function updateDraft(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireWrite()
  const values = readForm(formData)

  const invoice = await db.invoice.findUnique({ where: { id } })
  if (!invoice) return { errors: { form: 'That invoice no longer exists.' }, values }
  if (invoice.status !== 'DRAFT') {
    return { errors: { form: 'Only drafts can be edited.' }, values }
  }

  // The D.N. number is NOT stored here — it belongs to the equipment
  // assignment being billed, and the printed form derives it from there so the
  // two can never disagree.
  const invoiceNumber = (values.invoiceNumber ?? '').trim()
  if (!invoiceNumber) {
    return { errors: { invoiceNumber: 'Invoice number is required' }, values }
  }

  const clash = await db.invoice.findUnique({ where: { invoiceNumber } })
  if (clash && clash.id !== id) {
    return {
      errors: { invoiceNumber: 'Another invoice already uses that number.' },
      values,
    }
  }

  const newDueDate = parseDateInput(values.dueDate ?? '')

  await db.invoice.update({
    where: { id },
    data: {
      invoiceNumber,
      dueDate: newDueDate,
    },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: id,
    entityLabel: invoiceNumber,
    changedFields: [
      diffField('Invoice number', invoice.invoiceNumber, invoiceNumber),
      diffField('Due date', invoice.dueDate, newDueDate, fmt.date),
    ].filter((c): c is FieldChange => c !== null),
  })

  revalidatePath(`/invoices/${id}`)
  return {}
}

/**
 * Issues a draft, which FREEZES it.
 *
 * Line items already carry their own figures, so editing an assignment
 * afterwards cannot reach back and change what was sent to the customer. That
 * is the whole point: an issued invoice is a statement of what was claimed on
 * a date, not a live view.
 */
export async function issueInvoice(id: string) {
  const user = await requireWrite()

  const invoice = await db.invoice.findUnique({ where: { id } })
  if (!invoice || invoice.status !== 'DRAFT') return

  await db.invoice.update({
    where: { id },
    data: { status: 'ISSUED', issuedDate: invoice.issuedDate ?? todayUtc() },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: id,
    entityLabel: `Issued — ${invoice.invoiceNumber}`,
    changedFields: [{ field: 'Status', was: 'Draft', now: 'Issued' }],
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
}

export async function markPaid(id: string) {
  const user = await requireWrite()

  const invoice = await db.invoice.update({
    where: { id },
    data: { status: 'PAID', paidDate: todayUtc() },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: id,
    entityLabel: `Marked paid — ${invoice.invoiceNumber}`,
    changedFields: [
      { field: 'Status', was: 'Issued', now: 'Paid' },
      createdField('Paid date', invoice.paidDate, fmt.date),
    ],
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
}

/** Back to unpaid — for when a payment was recorded against the wrong invoice. */
export async function markUnpaid(id: string) {
  const user = await requireWrite()

  const invoice = await db.invoice.update({
    where: { id },
    data: { status: 'ISSUED', paidDate: null },
  })

  await logAudit({
    user,
    action: 'UPDATE',
    entityType: 'Invoice',
    entityId: id,
    entityLabel: `Marked unpaid — ${invoice.invoiceNumber}`,
    changedFields: [{ field: 'Status', was: 'Paid', now: 'Issued' }],
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
}

/** Drafts only. An issued invoice has left the building and stays on record. */
export async function deleteDraft(id: string) {
  const user = await requireDelete()

  const invoice = await db.invoice.findUnique({ where: { id } })
  if (!invoice || invoice.status !== 'DRAFT') return

  await db.invoice.delete({ where: { id } })

  await logAudit({
    user,
    action: 'DELETE',
    entityType: 'Invoice',
    entityId: invoice.id,
    entityLabel: invoice.invoiceNumber,
    changedFields: [
      deletedField('Invoice number', invoice.invoiceNumber),
      deletedField('Amount', invoice.totalAmount, fmt.money),
    ],
  })

  revalidatePath('/invoices')
  redirect('/invoices')
}
