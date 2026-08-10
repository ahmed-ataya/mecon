'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { formatDate } from '@/lib/dates'
import { Combobox } from '@/components/ui/Combobox'
import { BillingCalendar } from './BillingCalendar'
import { HireBar, HireScale } from './HireBar'
import {
  Field,
  FormError,
  buttonPrimaryClass,
  buttonSecondaryClass,
} from '@/components/ui/form'
import type { ActionState } from '@/lib/actions/invoices'
import type { PartyOption } from '@/lib/contract-options'

export type ContractChoice = {
  id: string
  projectName: string
  siteName: string
  customerId: string
  lpoId: string | null
  lpoNumber: string | null
  machineName: string | null
  mobilizationDate: Date
  closingDate: Date | null
  /** When the machine actually started, which is not the mobilization date. */
  workedFrom: Date | null
  /** Null means still on hire. */
  workedTo: Date | null
  /** Latest period end already invoiced, drafts included. */
  invoicedThrough: Date | null
  hasDraft: boolean
  offHire: { startDate: Date; endDate: Date | null }[]
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function toInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

/**
 * The first day not yet billed on a contract.
 *
 * Null when the machine has never worked, or when everything up to the end of
 * hire is already invoiced.
 */
function nextUninvoicedFrom(contract: ContractChoice): Date | null {
  if (!contract.workedFrom) return null

  const from = contract.invoicedThrough
    ? addDays(contract.invoicedThrough, 1)
    : contract.workedFrom

  if (contract.workedTo && from > contract.workedTo) return null

  return from
}

/**
 * Generates draft invoices for a period.
 *
 * Defaults reflect how the work is actually done: one invoice per contract
 * (which is one machine), because a dispute over one machine must not hold up
 * payment on the others. Combining is available because customers ask for it,
 * but it is a deliberate tick rather than the default.
 */
export function GenerateForm({
  action,
  customers,
  contracts,
  defaultStart,
  defaultEnd,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  customers: PartyOption[]
  contracts: ContractChoice[]
  defaultStart: string
  defaultEnd: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const errors = state.errors ?? {}
  const values = state.values ?? {}

  const [customerId, setCustomerId] = useState(values.customerId ?? '')
  const [selected, setSelected] = useState<string[]>([])
  const [combine, setCombine] = useState(false)

  // The dates are suggested from what has actually been billed, so nobody has
  // to open the contract to find out where the last invoice stopped.
  const [periodStart, setPeriodStart] = useState(
    values.periodStart ?? defaultStart,
  )
  const [periodEnd, setPeriodEnd] = useState(values.periodEnd ?? defaultEnd)
  const [touchedDates, setTouchedDates] = useState(false)

  const forCustomer = contracts.filter(
    (contract) => contract.customerId === customerId,
  )

  // One scale for every bar on screen, so two machines can be compared by eye.
  // Padded to whole months, and always wide enough to show the chosen period.
  const anchors: Date[] = []
  for (const contract of forCustomer) {
    if (contract.workedFrom) anchors.push(contract.workedFrom)
    if (contract.workedTo) anchors.push(contract.workedTo)
    if (contract.invoicedThrough) anchors.push(contract.invoicedThrough)
  }
  const selStart = periodStart ? new Date(`${periodStart}T00:00:00.000Z`) : null
  const selEnd = periodEnd ? new Date(`${periodEnd}T00:00:00.000Z`) : null
  if (selStart) anchors.push(selStart)
  if (selEnd) anchors.push(selEnd)

  const earliest =
    anchors.length > 0
      ? anchors.reduce((min, d) => (d < min ? d : min))
      : new Date()
  const latest =
    anchors.length > 0
      ? anchors.reduce((max, d) => (d > max ? d : max))
      : new Date()

  const rangeStart = new Date(
    Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1),
  )
  const rangeEnd = new Date(
    Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0),
  )

  const chosen = forCustomer.filter((contract) => selected.includes(contract.id))
  const lpoIds = [...new Set(chosen.map((contract) => contract.lpoId))]
  const mixedLpos = combine && lpoIds.length > 1

  // The window that can actually be invoiced for what is selected. Fed to the
  // date inputs as min/max, which is what greys out the impossible days in the
  // browser's own calendar — the same way a flight search greys out dates you
  // cannot fly.
  //
  // Earliest: the first day not yet billed. Anything before it is either
  // before the machine arrived or already on an invoice.
  const billableFrom = (() => {
    const starts = chosen
      .map(nextUninvoicedFrom)
      .filter((date): date is Date => date !== null)

    if (starts.length === 0) return null
    return starts.reduce((min, date) => (date < min ? date : min))
  })()

  // Latest: when the hire ended. An ongoing hire runs to the end of this
  // month, since invoicing further ahead would bill days that have not
  // happened.
  const billableTo = (() => {
    if (chosen.length === 0) return null

    const now = new Date()
    const endOfThisMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    )

    const ends = chosen.map((contract) => contract.workedTo ?? endOfThisMonth)
    if (ends.length === 0) return null

    return ends.reduce((max, date) => (date > max ? date : max))
  })()

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((value) => value !== id)
      : [...selected, id]

    setSelected(next)

    // Only suggest while the dates are untouched — once they have been edited
    // by hand, moving them under the user would be worse than unhelpful.
    if (touchedDates || next.length === 0) return

    const starts = next
      .map((contractId) => contracts.find((c) => c.id === contractId))
      .filter((c): c is ContractChoice => !!c)
      .map(nextUninvoicedFrom)
      .filter((date): date is Date => date !== null)

    if (starts.length === 0) return

    const from = starts.reduce((min, date) => (date < min ? date : min))

    // A month is the usual unit here, so suggest to the end of that month —
    // clipped if the hire finished sooner.
    const chosenContracts = next
      .map((contractId) => contracts.find((c) => c.id === contractId))
      .filter((c): c is ContractChoice => !!c)
    const hireEnds = chosenContracts
      .map((c) => c.workedTo)
      .filter((date): date is Date => date !== null)

    let to = endOfMonth(from)
    if (
      hireEnds.length === chosenContracts.length &&
      hireEnds.length > 0
    ) {
      const lastEnd = hireEnds.reduce((max, d) => (d > max ? d : max))
      if (lastEnd < to) to = lastEnd
    }

    setPeriodStart(toInput(from))
    setPeriodEnd(toInput(to))
  }

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={errors.form} />

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Customer</h2>

        <Field label="Customer" htmlFor="customerId">
          <Combobox
            name="customerId"
            options={customers}
            defaultValue={customerId}
            placeholder="Search customers…"
            onSelect={(value) => {
              setCustomerId(value)
              setSelected([])
            }}
          />
          {errors.customerId && (
            <p className="mt-1 text-xs text-red-600">{errors.customerId}</p>
          )}
        </Field>

        <p className="rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
          {billableFrom && billableTo ? (
            <>
              <span className="font-medium text-slate-800">
                You can invoice {formatDate(billableFrom)} to{' '}
                {formatDate(billableTo)}
              </span>{' '}
              for what is selected. The calendar greys out everything else —
earlier days are already invoiced or before the machine arrived,
              later days have not happened yet.
            </>
          ) : chosen.length > 0 ? (
            <span className="font-medium text-slate-800">
              Everything on the selected contracts is already invoiced.
            </span>
          ) : (
            <>
              Pick the contracts below first — the dates fill in from where the
              last invoice stopped, and the calendar limits itself to days you
              can actually invoice.
            </>
          )}
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">Contracts to bill</h2>
          <p className="mt-1 text-sm text-slate-500">
            One contract is one machine. Pick the ones to invoice for this
            period.
          </p>
        </div>

        {!customerId ? (
          <p className="text-sm text-slate-500">Pick a customer first.</p>
        ) : forCustomer.length === 0 ? (
          <p className="text-sm text-slate-500">
            This customer has no contracts yet.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-green-400" />
                Not yet billed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-slate-400" />
                Already invoiced
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-red-400" />
                Off hire
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm border-x-2 border-slate-900 bg-slate-900/10" />
                This invoice
              </span>
            </div>

            <div className="pl-7 pr-1">
              <HireScale rangeStart={rangeStart} rangeEnd={rangeEnd} />
            </div>

            {forCustomer.map((contract) => (
              <label
                key={contract.id}
                className="flex items-start gap-3 rounded-md border border-slate-200 px-4 py-3"
              >
                <input
                  type="checkbox"
                  name="contractIds"
                  value={contract.id}
                  checked={selected.includes(contract.id)}
                  onChange={() => toggle(contract.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-slate-900">
                    {contract.machineName ?? 'No machine assigned'}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {contract.projectName}
                  </span>

                  <span className="mt-1 block text-xs text-slate-600">
                    {contract.workedFrom ? (
                      <>
                        <span className="font-medium">On hire</span>{' '}
                        {formatDate(contract.workedFrom)} –{' '}
                        {contract.workedTo
                          ? formatDate(contract.workedTo)
                          : 'ongoing'}
                      </>
                    ) : (
                      <span className="text-slate-400">
                        No machine assigned yet
                      </span>
                    )}
                  </span>

                  <span className="mt-0.5 block text-xs">
                    {contract.invoicedThrough ? (
                      <span className="text-slate-500">
                        Invoiced to {formatDate(contract.invoicedThrough)}
                        {contract.hasDraft && (
                          <span className="ml-1 text-amber-700">
                            (includes a draft)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-500">Never invoiced</span>
                    )}
                  </span>

                  {(() => {
                    const from = nextUninvoicedFrom(contract)
                    return from ? (
                      <span className="mt-0.5 block text-xs font-medium text-green-700">
                        Not yet billed from {formatDate(from)}
                      </span>
                    ) : contract.workedFrom ? (
                      <span className="mt-0.5 block text-xs text-slate-400">
                        Fully invoiced
                      </span>
                    ) : null
                  })()}

                  <span className="mt-2 block">
                    <HireBar
                      rangeStart={rangeStart}
                      rangeEnd={rangeEnd}
                      workedFrom={contract.workedFrom}
                      workedTo={contract.workedTo}
                      invoicedThrough={contract.invoicedThrough}
                      offHire={contract.offHire}
                      periodStart={selStart}
                      periodEnd={selEnd}
                    />
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {errors.contractIds && (
          <p className="text-xs text-red-600">{errors.contractIds}</p>
        )}

        {selected.length > 1 && (
          <label className="flex items-start gap-3 rounded-md bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-200">
            <input
              type="checkbox"
              name="combine"
              checked={combine}
              onChange={(event) => setCombine(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-amber-900">
              <span className="font-medium">
                Combine all {selected.length} onto one invoice
              </span>
              <span className="mt-0.5 block text-xs">
                Only if the customer has asked. If they dispute one machine,
                payment on every machine on this invoice is held up — which is
                why separate invoices are the default.
              </span>
            </span>
          </label>
        )}

        {mixedLpos && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            Those contracts are on different LPOs, so they cannot share one
            invoice — the form carries a single “Your Order No.”.
          </p>
        )}
        {errors.combine && (
          <p className="text-xs text-red-600">{errors.combine}</p>
        )}
      </section>

      <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">Period to invoice</h2>
          <p className="mt-1 text-sm text-slate-500">
            Click the first day, then the last. Only days that can actually be
            invoiced are selectable.
          </p>
        </div>

        {/* Hidden inputs carry the values; the calendar is the control. */}
        <input type="hidden" name="periodStart" value={periodStart} readOnly />
        <input type="hidden" name="periodEnd" value={periodEnd} readOnly />

        {chosen.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Pick the machines below and the calendar appears here, with the days
            you can invoice marked.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="font-medium text-slate-800">
                {periodStart && periodEnd
                  ? `${formatDate(new Date(`${periodStart}T00:00:00.000Z`))} – ${formatDate(new Date(`${periodEnd}T00:00:00.000Z`))}`
                  : periodStart
                    ? `${formatDate(new Date(`${periodStart}T00:00:00.000Z`))} – pick the end date`
                    : 'Pick the first day'}
              </span>
              {(periodStart || periodEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriodStart('')
                    setPeriodEnd('')
                    setTouchedDates(true)
                  }}
                  className="text-xs text-slate-500 underline hover:text-slate-800"
                >
                  clear
                </button>
              )}
            </div>

            <BillingCalendar
              contracts={chosen}
              start={periodStart}
              end={periodEnd}
              onChange={(nextStart, nextEnd) => {
                setPeriodStart(nextStart)
                setPeriodEnd(nextEnd)
                setTouchedDates(true)
              }}
            />

            {errors.periodStart && (
              <p className="text-xs text-red-600">{errors.periodStart}</p>
            )}
            {errors.periodEnd && (
              <p className="text-xs text-red-600">{errors.periodEnd}</p>
            )}
          </>
        )}

        <label className="flex items-start gap-3 rounded-md bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200">
          <input
            type="checkbox"
            name="splitMonthly"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-800">
              One invoice per calendar month
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              A hire from 1 Aug to 15 Oct becomes an August, a September and a
              part-October invoice. Leave unticked for a single invoice covering
              the whole span.
            </span>
          </span>
        </label>
      </section>


      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="font-semibold">Mobilization</h2>
          <p className="mt-1 text-sm text-slate-500">
            Both print at the bottom of the invoice. Mobilization normally goes
            on the first invoice and de-mobilization on the last — but a short
            hire often bills de-mob up front.
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="includeMobilization"
            className="h-4 w-4 rounded border-slate-300"
          />
          Include mobilization charge
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="includeDemobilization"
            className="h-4 w-4 rounded border-slate-300"
          />
          Include de-mobilization charge
        </label>

        <p className="text-xs text-slate-500">
          A contract that mobilizes free of charge adds no line and says so
          rather than silently doing nothing.
        </p>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={buttonPrimaryClass}>
          {pending ? 'Generating…' : 'Generate drafts'}
        </button>
        <Link href="/invoices" className={buttonSecondaryClass}>
          Cancel
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        Everything is created as a draft. Nothing counts against an LPO, and
        nothing is frozen, until you issue it.
      </p>
    </form>
  )
}
