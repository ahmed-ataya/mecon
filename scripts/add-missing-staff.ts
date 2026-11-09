/**
 * One-off: add the people on the real staff list who don't exist on the
 * target system at all — not a standing app feature.
 *
 *   npx tsx scripts/add-missing-staff.ts            # dry run, prints the plan
 *   npx tsx scripts/add-missing-staff.ts --apply    # creates the records
 *
 * Runs against TARGET_DATABASE_URL if set, otherwise DATABASE_URL.
 *
 * Second half of the 2026-11-06 clean-up. scripts/merge-staff-list.ts filled
 * staff numbers, job titles and spelling into the 27 hand-entered records
 * that matched the spreadsheet, and by design never created anyone. This
 * creates the remaining 23 — workshop, office, management, drivers and
 * helpers, none of whom had been entered by hand — so the business doesn't
 * have to type them in.
 *
 * Two guards against creating a duplicate, because a duplicate employee is
 * expensive to undo once documents start hanging off both copies:
 *
 *  1. Skipped if any record already holds that staff number.
 *  2. Skipped, and reported, if any existing record shares two or more name
 *     words with the spreadsheet name — someone may have been entered by
 *     hand without a staff number. That case needs a human decision, not a
 *     second record.
 *
 * New records carry only what the spreadsheet has: name, staff number, job
 * title, category, and in-house. Phone, nationality, documents, salary and
 * joining date stay empty until supplied. Idempotent: guard 1 means a
 * second run creates nothing.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ROWS } from './staff-list'

function significantWords(name: string): Set<string> {
  return new Set(
    name
      .replace(/\s*\(\d{3,5}\)\s*/, ' ')
      .toUpperCase()
      .replace(/-/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

const CATEGORY_ORDER = [
  'OPERATOR',
  'MECHANIC_WORKSHOP',
  'ADMIN_OFFICE',
  'MANAGEMENT',
  'DRIVER',
  'HELPER_LABOURER',
]

async function main() {
  const apply = process.argv.includes('--apply')
  const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('No database URL. Set TARGET_DATABASE_URL or DATABASE_URL.')

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

  const existing = await db.employee.findMany({
    select: { name: true, employeeNumber: true },
  })
  const takenNumbers = new Set(existing.map((e) => e.employeeNumber).filter(Boolean))

  const toCreate: (typeof ROWS)[number][] = []
  const alreadyThere: string[] = []
  const needsDecision: { row: (typeof ROWS)[number]; lookalike: string }[] = []

  for (const row of ROWS) {
    if (takenNumbers.has(row.staffNo)) {
      alreadyThere.push(`${row.staffNo} ${row.name}`)
      continue
    }
    const words = significantWords(row.name)
    const lookalike = existing.find(
      (e) => [...significantWords(e.name)].filter((w) => words.has(w)).length >= 2,
    )
    if (lookalike) {
      needsDecision.push({ row, lookalike: lookalike.name })
      continue
    }
    toCreate.push(row)
  }

  console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN — nothing is being written ===\n')

  console.log(`Would create ${toCreate.length}:`)
  for (const cat of CATEGORY_ORDER) {
    const group = toCreate.filter((r) => r.category === cat)
    if (group.length === 0) continue
    console.log(`\n  ${cat} (${group.length})`)
    for (const r of group) {
      console.log(`    ${r.staffNo.padEnd(6)} ${r.name.padEnd(26)} ${r.designation}`)
    }
  }

  if (needsDecision.length > 0) {
    console.log(`\nSKIPPED — looks like someone already entered without a staff number:`)
    for (const { row, lookalike } of needsDecision) {
      console.log(`    ${row.staffNo} ${row.name}   resembles existing "${lookalike}"`)
    }
  }

  console.log(`\nAlready on the system (staff number present): ${alreadyThere.length}`)
  console.log(`Total after this: ${existing.length + toCreate.length} employees`)

  if (!apply) {
    console.log('\nRe-run with --apply to create these records.')
    await db.$disconnect()
    return
  }

  for (const row of toCreate) {
    await db.employee.create({
      data: {
        employeeNumber: row.staffNo,
        name: row.name,
        jobTitle: row.designation,
        category: row.category,
        source: 'IN_HOUSE',
      },
    })
  }
  console.log(`\nDone — ${toCreate.length} employees created.`)
  await db.$disconnect()
}

main()
