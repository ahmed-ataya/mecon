'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '../db'
import { buildProposal, splitIntoMonths, type ProposedLine } from '../billing'
import { parseDateInput, todayUtc } from '../dates'

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
 * The next rolling invoice number.
 *
 * Numbers come off a paper pad today, so this only suggests: the draft's number
 * stays editable until issue, letting the sequence be aligned with wherever the
 * pad has reached. The unique constraint is what actually prevents a clash.
 */
export async function nextInvoiceNumber(): Promise<string> {
  const invoices = await db.invoice.findMany({ select: { invoiceNumber: true } })

  const highest = invoices.reduce((max, invoice) => {
    // Ignore anything not purely numeric so a hand-typed "2026/A-12" cannot
    // poison the sequence.
    const parsed = Number(invoice.invoiceNumber)
    return Number.isInteger(parsed) && parsed > max ? parsed : max
  }, 0)

  return String(highest + 1)
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

  const splitMonthly = formData.get('splitMonthly') !== null
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

  const periods = splitMonthly
    ? splitIntoMonths(start!, end!)
    : [{ start: start!, end: end! }]

  // Grouped per invoice: either all contracts together, or one each.
  const groups = combine ? [contracts] : contracts.map((contract) => [contract])

  let sequence = Number(await nextInvoiceNumber())
  const created: string[] = []

  for (const period of periods) {
    for (const group of groups) {
      const lines: ProposedLine[] = []

      for (const contract of group) {
        const proposal = buildProposal({
          period,
          contract,
          equipmentAssignments: contract.equipmentAssignments,
          operatorAssignments: contract.operatorAssignments,
          mobilization: contract,
          includeMobilization,
          includeDemobilization,
        })
        lines.push(...proposal.lines)
      }

      // A period a contract was not running in produces nothing. Creating an
      // empty invoice would just be noise to delete later.
      if (lines.length === 0) continue

      const invoice = await db.invoice.create({
        data: {
          customerId,
          lpoId: group[0].lpoId,
          invoiceNumber: String(sequence++),
          periodStart: period.start,
          periodEnd: period.end,
          totalAmount: lines.reduce((sum, line) => sum + line.amount, 0),
          status: 'DRAFT',
          contracts: {
            create: group.map((contract) => ({ contractId: contract.id })),
          },
          lineItems: { create: lines },
        },
      })

      created.push(invoice.id)
    }
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

  await db.invoice.update({
    where: { id },
    data: {
      invoiceNumber,
      dueDate: parseDateInput(values.dueDate ?? ''),
    },
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
  const invoice = await db.invoice.findUnique({ where: { id } })
  if (!invoice || invoice.status !== 'DRAFT') return

  await db.invoice.update({
    where: { id },
    data: { status: 'ISSUED', issuedDate: invoice.issuedDate ?? todayUtc() },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
}

export async function markPaid(id: string) {
  await db.invoice.update({
    where: { id },
    data: { status: 'PAID', paidDate: todayUtc() },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
}

/** Back to unpaid — for when a payment was recorded against the wrong invoice. */
export async function markUnpaid(id: string) {
  await db.invoice.update({
    where: { id },
    data: { status: 'ISSUED', paidDate: null },
  })

  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
}

/** Drafts only. An issued invoice has left the building and stays on record. */
export async function deleteDraft(id: string) {
  const invoice = await db.invoice.findUnique({ where: { id } })
  if (!invoice || invoice.status !== 'DRAFT') return

  await db.invoice.delete({ where: { id } })

  revalidatePath('/invoices')
  redirect('/invoices')
}
