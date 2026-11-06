import { toCsv } from './csv'
import { getDocumentStatus } from './document-status'
import { BANKS, type Bank } from './enums'

/**
 * WPS SIF export, per bank — Phase F (CBQ), extended Phase F2 (QNB).
 *
 * Each bank has its own field layout, and nothing here is invented: both
 * layouts below are transcribed from a real sample SIF file, column label
 * by column label. These are NOT the official QCB fixed-width WPS spec,
 * which is a different thing — they match what each bank's own system
 * actually accepts as a two-block CSV (one header row carrying the
 * employer/payer's details, then one row per employee).
 *
 * The two layouts differ only in header label casing and three formatting
 * details, which is exactly why they're expressed as data in WPS_LAYOUTS
 * rather than as two near-identical generators: the differences are small
 * enough to lose in a diff, and a bank's parser may well be strict about
 * them.
 *
 * Provenance of the QNB layout (2026-09-26): taken from a real QNB SIF
 * file, which belongs to a DIFFERENT employer and is dated August 2022 —
 * only its column layout was used, never its contents. So the layout is
 * real but unverified for this employer and may have moved on since 2022;
 * the business will flag it if QNB rejects the file. Recorded this way at
 * the owner's explicit instruction rather than left blocked. See ROADMAP.md.
 */

export type WpsPayerConfig = {
  /**
   * The employer's own establishment number — labelled "Employer QID" by
   * CBQ and "Employer EID" by QNB, but the same number either way.
   */
  employerId: string
  /** Same value in every real sample seen so far — kept separate from
   * employerId in case a future sample shows them diverging. */
  payerEid: string
  payerIban: string
  bankShort: string
}

/** Real values taken from the business's own CBQ SIF sample — this is the
 * company's own banking identity (like a cheque or letterhead IBAN), not
 * employee data, so it's fine to keep in code the same way COMPANY's
 * details already are (src/lib/company.ts).
 *
 * QNB is absent deliberately, and it is NOT the layout that's missing any
 * more — it's this company's own QNB identity. Two values are needed
 * before a QNB file can be produced:
 *   1. payerIban — the company's QNB account IBAN. Genuinely unknown.
 *   2. employerId / payerEid — very likely the same establishment number
 *      as CBQ's (12943300), since it's the company's Ministry of Labour
 *      number rather than anything bank-specific. Confirm, don't assume:
 *      a wrong number here means a rejected file.
 * Fill both in and QNB export works with no further code changes. */
export const WPS_PAYER_CONFIG: Partial<Record<Bank, WpsPayerConfig>> = {
  CBQ: {
    employerId: '12943300',
    payerEid: '12943300',
    payerIban: 'QA42CBQA000000004550745755001',
    bankShort: 'CBQ',
  },
}

type WpsLayout = {
  /** The employer/payer header row's column labels, verbatim from that
   * bank's own sample — casing included, because that's the one thing a
   * strict parser is most likely to check and the two banks disagree on it
   * ("Total Records" vs "Total records", and four more like it). */
  payerHeader: readonly string[]
  employeeHeader: readonly string[]
  /** Record Sequence is zero-padded to this width. CBQ 5, QNB 6. */
  sequenceWidth: number
  /** Total Records zero-padded to this width, or null to write a plain
   * count. CBQ pads to 5; QNB's sample writes "1" for a one-record file,
   * so QNB does not pad. */
  totalRecordsWidth: number | null
  /** Literal Payment Type written on every employee row. CBQ's sample
   * leaves it empty; QNB's says "Normal Payment". */
  paymentType: string
}

export const WPS_LAYOUTS: Record<Bank, WpsLayout> = {
  CBQ: {
    payerHeader: [
      'Employer QID',
      'File Creation Date',
      'File Creation Time',
      'Payer EID',
      'Payer QID',
      'Payer Bank Short',
      'Payer IBAN',
      'Salary Year and Month',
      'Total Salaries',
      'Total Records',
    ],
    employeeHeader: [
      'Record Sequence',
      'Employee QID',
      'Employee Visa ID',
      'Employee Name',
      'Employee Bank Short name',
      'Employee Account',
      'Salary Frequency',
      'Number of Working days',
      'Net Salary',
      'Basic Salary',
      'Extra Hours',
      'Extra income',
      'Deductions',
      'Payment Type',
      'Note / Comments',
    ],
    sequenceWidth: 5,
    totalRecordsWidth: 5,
    paymentType: '',
  },
  QNB: {
    payerHeader: [
      'Employer EID',
      'File Creation Date',
      'File Creation Time',
      'Payer EID',
      'Payer QID',
      'Payer Bank Short Name',
      'Payer IBAN',
      'Salary Year and Month',
      'Total Salaries',
      'Total records',
    ],
    employeeHeader: [
      'Record Sequence',
      'Employee QID',
      'Employee Visa ID',
      'Employee Name',
      'Employee Bank Short Name',
      'Employee Account',
      'Salary Frequency',
      'Number of Working Days',
      'Net Salary',
      'Basic Salary',
      'Extra hours',
      'Extra Income',
      'Deductions',
      'Payment Type',
      'Notes / Comments',
    ],
    sequenceWidth: 6,
    totalRecordsWidth: null,
    paymentType: 'Normal Payment',
  },
}

/**
 * Why three states rather than a boolean: "we don't know the file layout"
 * and "we don't know our own account number" are different problems with
 * different fixes, and until QNB's layout arrived they were the same
 * thing. NEEDS_PAYER_DETAILS is a data-entry job for the business;
 * NO_LAYOUT needs a sample file from the bank.
 */
export type WpsBankReadiness = 'READY' | 'NEEDS_PAYER_DETAILS' | 'NO_LAYOUT'

export function wpsBankReadiness(bank: Bank): WpsBankReadiness {
  if (!WPS_LAYOUTS[bank]) return 'NO_LAYOUT'
  return WPS_PAYER_CONFIG[bank] ? 'READY' : 'NEEDS_PAYER_DETAILS'
}

// --- Pre-submission validation -----------------------------------------

export type WpsEmployeeIssue = {
  employeeId: string
  employeeName: string
  issues: string[]
}

type EmployeeForWpsCheck = {
  id: string
  name: string
  bankName: string | null
  bankAccountNumber: string | null
  documents: { documentType: string; isApplicable: boolean; expiryDate: Date | null }[]
}

/** A QID or Visa/Residence Permit that's on file, applicable, and not
 * expired — EXPIRING_SOON still counts as valid for this check, same as it
 * does everywhere else in this app; only EXPIRED or entirely missing
 * blocks the export. */
function hasValidIdentityDocument(employee: EmployeeForWpsCheck): boolean {
  return employee.documents.some((doc) => {
    if (doc.documentType !== 'Qatar ID' && doc.documentType !== 'Visa/Residence Permit') {
      return false
    }
    const status = getDocumentStatus(doc)
    return status === 'VALID' || status === 'EXPIRING_SOON' || status === 'NO_EXPIRY'
  })
}

function identityDocumentNumber(
  documents: { documentType: string; documentNumber: string | null }[],
): { qid: string | null; visaId: string | null } {
  const qid = documents.find((d) => d.documentType === 'Qatar ID')?.documentNumber ?? null
  const visaId = qid
    ? null
    : documents.find((d) => d.documentType === 'Visa/Residence Permit')?.documentNumber ?? null
  return { qid, visaId }
}

/**
 * Checks every employee being paid this period against what the bank file
 * needs — blocks the export with a clear list rather than producing a file
 * the bank will reject (explicit requirement, not a nice-to-have).
 */
export function validateEmployeesForWps(
  employees: EmployeeForWpsCheck[],
): WpsEmployeeIssue[] {
  const problems: WpsEmployeeIssue[] = []

  for (const employee of employees) {
    const issues: string[] = []

    if (!employee.bankName || !BANKS.includes(employee.bankName as Bank)) {
      issues.push('No bank assigned')
    }
    if (!employee.bankAccountNumber?.trim()) {
      issues.push('No IBAN / account number on file')
    }
    if (!hasValidIdentityDocument(employee)) {
      issues.push('No valid Qatar ID or Visa/Residence Permit on file')
    }

    if (issues.length > 0) {
      problems.push({ employeeId: employee.id, employeeName: employee.name, issues })
    }
  }

  return problems
}

// --- SIF generation ------------------------------------------------------

export type WpsPayslipInput = {
  employee: {
    id: string
    name: string
    bankAccountNumber: string | null
    documents: { documentType: string; documentNumber: string | null }[]
  }
  basicSalary: number // halalas
  overtimeHours: number
  overtimePay: number // halalas
  housingAllowance: number
  transportAllowance: number
  foodAllowance: number
  siteAllowance: number
  otherAllowance: number
  shortfallDeduction: number // halalas
  deductionsAmount: number // halalas
  deductionsNote: string | null
  netPay: number // halalas
}

function toRiyals(halalas: number): number {
  return Math.round(halalas) / 100
}

/**
 * Basic + Extra income − Deductions reconciles to Net Salary exactly, by
 * construction: Extra income folds in overtime pay and every allowance,
 * Deductions folds in both the shortfall deduction and the flat deductions
 * amount — the same two pieces that separately reduce basic pay and gross
 * pay in src/lib/payroll.ts's computePayslip. Neither sample file this is
 * modelled on always reconciles that cleanly; this does.
 *
 * Employee Bank Short Name is the payer bank: a real sample does show an
 * employee banking elsewhere than the payer, but this app groups payslips
 * by the employee's own bank and writes one file per group, so within any
 * one file the two always coincide.
 */
function buildEmployeeRow(
  bank: Bank,
  layout: WpsLayout,
  sequence: number,
  workingDays: number,
  payslip: WpsPayslipInput,
): (string | number)[] {
  const { qid, visaId } = identityDocumentNumber(payslip.employee.documents)

  const allowances =
    payslip.housingAllowance +
    payslip.transportAllowance +
    payslip.foodAllowance +
    payslip.siteAllowance +
    payslip.otherAllowance
  const extraIncome = payslip.overtimePay + allowances
  const deductions = payslip.shortfallDeduction + payslip.deductionsAmount

  return [
    String(sequence).padStart(layout.sequenceWidth, '0'),
    qid ?? '',
    visaId ?? '',
    payslip.employee.name,
    bank,
    payslip.employee.bankAccountNumber ?? '',
    'M',
    workingDays,
    toRiyals(payslip.netPay).toFixed(2),
    toRiyals(payslip.basicSalary).toFixed(2),
    payslip.overtimeHours,
    toRiyals(extraIncome).toFixed(2),
    toRiyals(deductions).toFixed(2),
    layout.paymentType,
    // 'NA' is CBQ's own sample convention for "nothing to say". QNB's
    // one-row sample carried a real note, so its empty convention is
    // unverified — 'NA' is reused rather than inventing a second one.
    payslip.deductionsNote?.trim() || 'NA',
  ]
}

export function generateSif({
  bank,
  payslips,
  year,
  month,
  generatedAt,
}: {
  bank: Bank
  payslips: WpsPayslipInput[]
  year: number
  month: number
  generatedAt: Date
}): { filename: string; content: string } {
  const config = WPS_PAYER_CONFIG[bank]
  if (!config) {
    throw new Error(`${bank}'s payer details are not configured yet.`)
  }
  const layout = WPS_LAYOUTS[bank]

  const workingDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const dateStamp = generatedAt.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStamp = generatedAt.toISOString().slice(11, 16).replace(':', '')

  const totalSalaries = payslips.reduce((sum, p) => sum + p.netPay, 0)
  const period = `${year}${String(month).padStart(2, '0')}`
  const totalRecords =
    layout.totalRecordsWidth === null
      ? String(payslips.length)
      : String(payslips.length).padStart(layout.totalRecordsWidth, '0')

  const rows: (string | number)[][] = [
    [...layout.payerHeader],
    [
      config.employerId,
      dateStamp,
      timeStamp,
      config.payerEid,
      '',
      config.bankShort,
      config.payerIban,
      period,
      toRiyals(totalSalaries).toFixed(2),
      totalRecords,
    ],
    [...layout.employeeHeader],
    ...payslips.map((payslip, index) =>
      buildEmployeeRow(bank, layout, index + 1, workingDaysInMonth, payslip),
    ),
  ]

  return {
    filename: `SIF_${config.employerId}_${config.bankShort}_${dateStamp}_${timeStamp}.csv`,
    content: toCsv(rows),
  }
}
