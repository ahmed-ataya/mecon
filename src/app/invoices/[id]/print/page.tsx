import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/dates'
import { formatAmountExact } from '@/lib/money'
import { COMPANY, INVOICE_FOOTER_TERM } from '@/lib/company'
import { PrintControls } from '@/components/invoices/PrintControls'

/**
 * The printed invoice, laid out to match the company's pre-printed pad.
 *
 * Two ways to print, toggled on screen and never in the printed output:
 *  - on blank paper, where the letterhead and footer print too
 *  - onto the existing pads, where they are suppressed so nothing double-prints
 *
 * The blank-paper version is the robust one; alignment onto pre-printed stock
 * varies between printers.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lpo: true,
      lineItems: {
        include: { equipmentAssignment: true },
      },
    },
  })

  if (!invoice) notFound()

  const deliveryNotes = [
    ...new Set(
      invoice.lineItems
        .map((line) => line.equipmentAssignment?.deliveryNoteNumber)
        .filter((value): value is string => !!value),
    ),
  ]

  // The pad has a fixed number of ruled rows; blanks keep the table the same
  // height whether there are two lines or ten.
  const blankRows = Math.max(0, 12 - invoice.lineItems.length)

  return (
    <>
      <PrintControls />

      <div className="invoice-sheet mx-auto max-w-[210mm] bg-white p-10 text-black">
        <header className="letterhead mb-8 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div className="text-sm font-semibold leading-tight">
            MEDITERRANEAN EQUIPMENT
            <br />
            AND CONTRACTING <span className="text-xs">W.L.L.</span>
          </div>

          <div className="text-center">
            {/* Logo drops in here once supplied. */}
            <div className="text-2xl font-bold tracking-wide">
              {COMPANY.shortName}
            </div>
          </div>

          <div dir="rtl" className="text-sm font-semibold leading-tight">
            {COMPANY.nameAr}
          </div>
        </header>

        <div className="mb-4 flex items-start justify-between text-sm">
          <div>
            <span className="font-semibold">No.:</span> {invoice.invoiceNumber}
          </div>
          <div>
            <span className="font-semibold">Date:</span>{' '}
            {formatDate(invoice.issuedDate ?? invoice.periodEnd)}
          </div>
        </div>

        <h1 className="mb-4 text-center text-lg font-bold underline">INVOICE</h1>

        <div className="mb-4 flex items-start justify-between text-sm">
          <div>
            <span className="font-semibold">D.N. NO.</span>{' '}
            {deliveryNotes.join(', ')}
          </div>
          <div className="text-right">
            <div>
              <span className="font-semibold">Your Order No.</span>{' '}
              {invoice.lpo?.number ?? ''}
            </div>
            <div>
              <span className="font-semibold">Your Order Date:</span>{' '}
              {invoice.lpo?.issuedDate ? formatDate(invoice.lpo.issuedDate) : ''}
            </div>
          </div>
        </div>

        <div className="mb-3 text-sm">
          <span className="font-semibold">Mr. / Messrs:</span>{' '}
          {invoice.customer.name}
        </div>

        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr>
              <th className="w-10 border border-black px-1 py-1">No.</th>
              <th className="border border-black px-2 py-1">PARTICULARS</th>
              <th className="w-16 border border-black px-1 py-1">UOM</th>
              <th className="w-16 border border-black px-1 py-1">Qty.</th>
              <th className="w-24 border border-black px-1 py-1">
                Rate
                <br />
                QAR.
              </th>
              <th className="w-28 border border-black px-1 py-1">
                Amount
                <br />
                QAR.
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line, index) => (
              <tr key={line.id}>
                <td className="border border-black px-1 py-1 text-center">
                  {index + 1}
                </td>
                <td className="border border-black px-2 py-1">
                  {line.description}
                </td>
                <td className="border border-black px-1 py-1 text-center">
                  {line.uom}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {line.quantity}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {formatAmountExact(line.unitRate)}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {formatAmountExact(line.amount)}
                </td>
              </tr>
            ))}

            {Array.from({ length: blankRows }).map((_, index) => (
              <tr key={`blank-${index}`}>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-2 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
              </tr>
            ))}

            <tr>
              <td
                colSpan={5}
                className="border border-black px-2 py-2 font-bold"
              >
                TOTAL QAR
              </td>
              <td className="border border-black px-1 py-2 text-right font-bold">
                {formatAmountExact(invoice.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="border-x border-b border-black px-3 py-4 text-sm font-bold">
          {INVOICE_FOOTER_TERM}
        </div>

        <div className="mt-12 flex items-end justify-between text-sm font-bold">
          <div className="border-t border-black pt-1 pr-16">
            Receiver&rsquo;s Name &amp; Signature
          </div>
          <div className="border-t border-black pl-16 pt-1">
            For {COMPANY.shortName}
          </div>
        </div>

        <footer className="letterhead mt-10 border-t border-black pt-2 text-center text-[10px] leading-snug">
          <div>
            Tel.: {COMPANY.tel} &nbsp; Fax: {COMPANY.fax} &nbsp; {COMPANY.poBox}
          </div>
          <div>
            Email: {COMPANY.email} &nbsp; Website: {COMPANY.website}
          </div>
          <div>
            {COMPANY.paidUpCapital} &nbsp;·&nbsp; {COMPANY.certification}
          </div>
        </footer>
      </div>
    </>
  )
}
