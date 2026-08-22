import { toCsv } from './csv'
import { getDocumentStatus } from './document-status'
import { BANKS, type Bank } from './enums'

/**
 * WPS SIF export, per bank — Phase F. Each bank has its own field layout;
 * building one from a guess risks the bank rejecting the file, so nothing
 * here is invented. CBQ's layout below is taken directly from a real
 * sample SIF file the business supplied (a two-block CSV: a header row
 * with the employer/payer's own details, then one row per employee) — not
 * the official QCB fixed-width WPS spec, which is a different thing; this
 * matches what CBQ's own system actually expects from this employer.
 *
 * QNB has no config yet — it needs its own sample file before it can be
 * added here. See ROADMAP.md.
 */

export type WpsPayerConfig = {
  /** The employer's own QID/establishment number with this bank. */
  employerQid: string
  /** Same value in every real sample seen so far — kept separate from
   * employerQid in case a future sample shows them diverging. */
  payerEid: string
  payerIban: string
  bankShort: string
}

/** Real values taken from the business's own CBQ SIF sample — this is the
 * company's own banking identity (like a cheque or letterhead IBAN), not
 * employee data, so it's fine to keep in code the same way COMPANY's
 * details already are (src/lib/company.ts). */
export const WPS_PAYER_CONFIG: Partial<Record<Bank, WpsPayerConfig>> = {
  CBQ: {
    employerQid: '12943300',
    payerEid: '12943300',
    payerIban: 'QA42CBQA000000004550745755001',
    bankShort: 'CBQ',
  },
}

export function isWpsBankConfigured(bank: Bank): boolean {
  return WPS_PAYER_CONFIG[bank] !== undefined
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

// --- CBQ SIF generation --------------------------------------------------

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
 * pay in src/lib/payroll.ts's computePayslip. The sample file this is
 * modelled on doesn't always reconcile that cleanly; this does.
 */
function buildCbqRow(sequence: number, payslip: WpsPayslipInput): (string | number)[] {
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
    String(sequence).padStart(5, '0'),
    qid ?? '',
    visaId ?? '',
    payslip.employee.name,
    'CBQ',
    payslip.employee.bankAccountNumber ?? '',
    'M',
    0, // filled in by the caller, which knows the period
    toRiyals(payslip.netPay).toFixed(2),
    toRiyals(payslip.basicSalary).toFixed(2),
    payslip.overtimeHours,
    toRiyals(extraIncome).toFixed(2),
    toRiyals(deductions).toFixed(2),
    '',
    payslip.deductionsNote?.trim() || 'NA',
  ]
}

export function generateCbqSif({
  payslips,
  year,
  month,
  generatedAt,
}: {
  payslips: WpsPayslipInput[]
  year: number
  month: number
  generatedAt: Date
}): { filename: string; content: string } {
  const config = WPS_PAYER_CONFIG.CBQ
  if (!config) throw new Error('CBQ is not configured yet.')

  const workingDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const dateStamp = generatedAt.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStamp = generatedAt.toISOString().slice(11, 16).replace(':', '')

  const totalSalaries = payslips.reduce((sum, p) => sum + p.netPay, 0)
  const period = `${year}${String(month).padStart(2, '0')}`

  const rows: (string | number)[][] = [
    [
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
    [
      config.employerQid,
      dateStamp,
      timeStamp,
      config.payerEid,
      '',
      config.bankShort,
      config.payerIban,
      period,
      toRiyals(totalSalaries).toFixed(2),
      String(payslips.length).padStart(5, '0'),
    ],
    [
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
    ...payslips.map((payslip, index) => {
      const row = buildCbqRow(index + 1, payslip)
      row[7] = workingDaysInMonth
      return row
    }),
  ]

  return {
    filename: `SIF_${config.employerQid}_${config.bankShort}_${dateStamp}_${timeStamp}.csv`,
    content: toCsv(rows),
  }
}
