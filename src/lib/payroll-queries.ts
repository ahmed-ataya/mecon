import { db } from './db'

export async function loadPayrollPeriods() {
  return db.payrollPeriod.findMany({
    include: {
      payslips: { select: { netPay: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
}

export async function loadPayrollPeriod(id: string) {
  return db.payrollPeriod.findUnique({
    where: { id },
    include: {
      payslips: {
        include: { employee: true },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  })
}

/** For WPS export — needs each employee's documents too (QID/Visa
 * validity check), which loadPayrollPeriod doesn't fetch. */
export async function loadPayrollPeriodForWps(id: string) {
  return db.payrollPeriod.findUnique({
    where: { id },
    include: {
      payslips: {
        include: { employee: { include: { documents: true } } },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  })
}

export async function loadPayslip(id: string) {
  return db.payslip.findUnique({
    where: { id },
    include: {
      employee: true,
      payrollPeriod: true,
    },
  })
}

export async function loadRamadanPeriods() {
  return db.ramadanPeriod.findMany({ orderBy: { year: 'desc' } })
}
