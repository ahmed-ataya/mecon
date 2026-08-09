/**
 * Company details as they appear on the printed invoice pad.
 *
 * Kept here rather than hard-coded into the invoice template so a change of
 * phone number or P.O. box is a one-line edit, not a hunt through markup.
 * Taken from the pre-printed stationery.
 */
export const COMPANY = {
  nameEn: 'MEDITERRANEAN EQUIPMENT AND CONTRACTING W.L.L.',
  nameAr: 'ميدتـرينيــان للـمعــدات والمقـــــاولات ذ.م.م',
  shortName: 'ME.CON',

  tel: '+974 4460 1508',
  fax: '+974 4460 6527',
  poBox: 'P.O. Box: 12072 Doha - Qatar',
  email: 'info@meconqatar.com',
  website: 'www.meconqatar.com',
  paidUpCapital: 'Paid up Capital: Qrs 400,000.00',
  certification: 'ISO 9001 Registered',

  /**
   * The objection window printed at the foot of every invoice. Not a payment
   * term — it is the window for disputing the invoice, and it is why the
   * one-invoice-per-machine rule matters: a dispute on one machine must not
   * hold up payment on the others.
   */
  objectionDays: 15,
} as const

export const INVOICE_FOOTER_TERM = `The above invoice is considered correct if no objection is received within ${COMPANY.objectionDays} days from date of invoice`
