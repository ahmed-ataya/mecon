import { isWorkingDay } from './dates'
import { formatQar } from './money'

/**
 * Statutory minimum wage — Law No. 17 of 2020, effective March 2021.
 * Halalas throughout, same convention as every other money field.
 */
export const MINIMUM_BASIC_SALARY = 100_000 // QAR 1,000
export const MINIMUM_HOUSING_ALLOWANCE = 50_000 // QAR 500
export const MINIMUM_FOOD_ALLOWANCE = 30_000 // QAR 300

export const STANDARD_HOURS_PER_DAY = 8
export const RAMADAN_HOURS_PER_DAY = 6
export const OVERTIME_RATE_MULTIPLIER = 1.25

export type MinimumWageCheck = {
  meetsMinimum: boolean
  shortfalls: string[]
}

/**
 * Non-blocking, same philosophy as every other warning in this app — the
 * business sometimes proceeds knowingly. Housing/food minimums only apply
 * when NOT provided in kind.
 */
export function checkMinimumWage({
  basicSalary,
  housingAllowance,
  foodAllowance,
  housingProvidedInKind,
  foodProvidedInKind,
}: {
  basicSalary: number | null
  housingAllowance: number | null
  foodAllowance: number | null
  housingProvidedInKind: boolean
  foodProvidedInKind: boolean
}): MinimumWageCheck {
  const shortfalls: string[] = []

  if (basicSalary === null || basicSalary < MINIMUM_BASIC_SALARY) {
    shortfalls.push(`Basic salary must be at least ${formatQar(MINIMUM_BASIC_SALARY)}`)
  }
  if (
    !housingProvidedInKind &&
    (housingAllowance === null || housingAllowance < MINIMUM_HOUSING_ALLOWANCE)
  ) {
    shortfalls.push(
      `Housing allowance must be at least ${formatQar(MINIMUM_HOUSING_ALLOWANCE)} unless provided in kind`,
    )
  }
  if (
    !foodProvidedInKind &&
    (foodAllowance === null || foodAllowance < MINIMUM_FOOD_ALLOWANCE)
  ) {
    shortfalls.push(
      `Food allowance must be at least ${formatQar(MINIMUM_FOOD_ALLOWANCE)} unless provided in kind`,
    )
  }

  return { meetsMinimum: shortfalls.length === 0, shortfalls }
}

/**
 * Every calendar day's standard hours for one month — 8, or 6 inside a
 * Ramadan period (no pay reduction; that's why standard hours drop rather
 * than a deduction being calculated), 0 on Friday. This is what a
 * timesheet-sourced payslip's regularHours is measured AGAINST to find a
 * shortfall — not what an ESTIMATE-sourced payslip pays outright, though
 * for that source regularHours starts out equal to this figure (fully
 * editable from there).
 */
export function standardHoursForMonth({
  year,
  month,
  ramadanPeriods,
}: {
  year: number
  month: number
  ramadanPeriods: { startDate: Date; endDate: Date }[]
}): number {
  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))

  let hours = 0
  for (
    let cursor = monthStart;
    cursor <= monthEnd;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    if (!isWorkingDay(cursor)) continue

    const inRamadan = ramadanPeriods.some(
      (period) => cursor >= period.startDate && cursor <= period.endDate,
    )
    hours += inRamadan ? RAMADAN_HOURS_PER_DAY : STANDARD_HOURS_PER_DAY
  }

  return hours
}

export type PayslipCalculationInput = {
  basicSalary: number
  housingAllowance: number
  transportAllowance: number
  foodAllowance: number
  siteAllowance: number
  otherAllowance: number
  standardHours: number
  regularHours: number
  overtimeHours: number
  deductionsAmount: number
}

export type PayslipCalculation = {
  dailyRate: number
  hourlyRate: number
  shortfallHours: number
  shortfallDeduction: number
  overtimePay: number
  basicPay: number
  grossPay: number
  netPay: number
}

/**
 * The single place payroll turns hours into money. Per ROADMAP.md's Phase
 * E3: "the single easiest thing to get wrong in this whole module" — every
 * step below is spelled out rather than compressed.
 *
 * Daily/hourly rate: basic ÷ 30 ÷ 8 — the same 30-day divisor Article 54's
 * gratuity formula uses (basic ÷ 30 × 21 × years), kept consistent rather
 * than inventing a second convention for the same "a day's pay" concept.
 *
 * A full standard month with no shortfall and no overtime returns
 * basicPay === basicSalary exactly. hours × rate only ever MOVES pay off
 * that baseline — deducted for hours genuinely not worked, added for
 * overtime — never used to compute the whole figure from scratch. That
 * matters because actual working days in a month (~26, Friday off) times 8
 * hours is ~208, not the 240 a flat 30×8 divisor implies; hours × rate
 * alone would underpay a completely normal month by that gap.
 *
 * Allowances are flat monthly amounts, never scaled by hours — only basic
 * salary is the legal base for overtime and shortfall math (Qatar Labour
 * Law: gratuity, overtime and leave pay are calculated on basic only,
 * never gross).
 *
 * Overtime is always the standard 125% rate here. Night work (9pm-6am) and
 * rest-day/public-holiday work carry higher statutory rates (150%), but
 * nothing in this system records TIME OF DAY as real data yet — a
 * timesheet day's start/end times are reference text only, never used in a
 * calculation (see EquipmentTimesheetDay's model comment) — so those
 * higher tiers can't be detected automatically. Only 125% is applied; a
 * night or rest-day premium needs a manual adjustment for now.
 *
 * Any hours short of standardHours are treated as an unpaid gap — there is
 * no leave management yet (Phase E2) to tell paid sick leave apart from
 * unpaid absence, so every shortfall is deducted without asking why.
 * Revisit once E2 exists.
 */
export function computePayslip(input: PayslipCalculationInput): PayslipCalculation {
  const dailyRate = input.basicSalary / 30
  const hourlyRate = dailyRate / STANDARD_HOURS_PER_DAY

  const shortfallHours = Math.max(0, input.standardHours - input.regularHours)
  const shortfallDeduction = Math.round(shortfallHours * hourlyRate)
  const overtimePay = Math.round(
    input.overtimeHours * hourlyRate * OVERTIME_RATE_MULTIPLIER,
  )

  const basicPay = input.basicSalary - shortfallDeduction + overtimePay
  const allowances =
    input.housingAllowance +
    input.transportAllowance +
    input.foodAllowance +
    input.siteAllowance +
    input.otherAllowance
  const grossPay = basicPay + allowances
  const netPay = grossPay - input.deductionsAmount

  return {
    dailyRate,
    hourlyRate,
    shortfallHours,
    shortfallDeduction,
    overtimePay,
    basicPay,
    grossPay,
    netPay,
  }
}
