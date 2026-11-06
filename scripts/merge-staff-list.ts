/**
 * One-off merge of the real staff list onto the employee records that were
 * already entered by hand — not a standing app feature.
 *
 *   npx tsx scripts/merge-staff-list.ts            # dry run, prints the plan
 *   npx tsx scripts/merge-staff-list.ts --apply    # writes the changes
 *
 * Background. The staff list supplied 2026-08-18 ("Employe List.xlsx") was
 * imported by scripts/import-employees.ts into the DEVELOPMENT database
 * only — the live system never received it. What the live system has
 * instead is 28 records someone entered by hand between 15 and 19 August:
 * every one filed as OPERATOR, every one with `employeeNumber` blank, and
 * eleven of them carrying the staff number inside the NAME, as in
 * "LATIF GUL (5454)".
 *
 * Those hand-entered records are NOT the lesser copy. They carry the
 * phone numbers, nationalities, notes, in-house/market flag, 141 documents
 * and the job assignments — none of which is on the spreadsheet. So this
 * merges the spreadsheet INTO them; it never replaces or deletes a record.
 *
 * Three decisions, all confirmed by the owner before this was written:
 *
 *  1. The spreadsheet is the source of truth for SPELLING. Four names
 *     genuinely conflict and the spreadsheet wins each one (see
 *     SPELLING_FIXES). Note 5456 reads as though the spreadsheet is the
 *     one with the typo — flagged, and the owner's rule applied anyway.
 *  2. Longer names in the app are KEPT. Seven records carry a surname the
 *     spreadsheet dropped ("Abeywardhana Mudiyanselage" vs
 *     "Abeywardhana"). A fuller name is not a misspelling, so only the
 *     misspelled WORD is corrected and the rest of the name is left alone.
 *  3. A staff number written into a name moves to the field it belongs in,
 *     and comes out of the name.
 *
 * Matching is deliberately conservative. A staff number found inside the
 * name is trusted outright; otherwise two or more shared name words are
 * required. Anything that doesn't match is REPORTED AND SKIPPED, never
 * guessed at — a mis-pairing here would eventually put one man's salary
 * against another man's record.
 *
 * Idempotent: re-running changes nothing once applied, because every
 * update is skipped when the record already holds the intended value.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ROWS, type Row } from './staff-list'

/**
 * The four names where the app and the spreadsheet genuinely disagree, as
 * opposed to the app simply having more of the name. Keyed by staff number
 * so a name edit can't silently detach the fix from the person. Only these
 * exact words are replaced; everything else in the name is preserved.
 */
const SPELLING_FIXES: Record<string, { from: string; to: string }[]> = {
  '5400': [{ from: 'KIMAR', to: 'Kumar' }],
  '5422': [{ from: 'SHASHINTHA', to: 'Sashintha' }],
  '5456': [{ from: 'SENDILNADAN', to: 'Sendilnanan' }],
  '5463': [{ from: 'ASISH', to: 'Ashish' }],
}

const STAFF_NO_IN_NAME = /\s*\((\d{3,5})\)\s*/

function significantWords(name: string): Set<string> {
  return new Set(
    name
      .replace(STAFF_NO_IN_NAME, ' ')
      .toUpperCase()
      .replace(/-/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

/** Title Case, to match the spreadsheet's own style — the live records are
 * shouted in ALL CAPS purely because of how they were typed in. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

function intendedName(liveName: string, staffNo: string): string {
  let name = liveName.replace(STAFF_NO_IN_NAME, ' ').trim().replace(/\s+/g, ' ')
  for (const { from, to } of SPELLING_FIXES[staffNo] ?? []) {
    name = name.replace(new RegExp(`\\b${from}\\b`, 'gi'), to.toUpperCase())
  }
  return titleCase(name)
}

type Match = { row: Row; how: string }

function findMatch(liveName: string, byStaffNo: Map<string, Row>): Match | null {
  const inName = liveName.match(STAFF_NO_IN_NAME)
  if (inName) {
    const row = byStaffNo.get(inName[1])
    if (row) return { row, how: `staff no. ${inName[1]} found in the name` }
  }

  const liveWords = significantWords(liveName)
  let best: Row | null = null
  let bestScore = 0
  let tied = false
  for (const row of ROWS) {
    const score = [...significantWords(row.name)].filter((w) => liveWords.has(w)).length
    if (score > bestScore) {
      best = row
      bestScore = score
      tied = false
    } else if (score === bestScore && score > 0) {
      tied = true
    }
  }
  if (best && bestScore >= 2 && !tied) {
    return { row: best, how: `${bestScore} matching name words` }
  }
  return null
}

async function main() {
  const apply = process.argv.includes('--apply')
  const url = process.env.MERGE_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('No database URL. Set MERGE_DATABASE_URL or DATABASE_URL.')

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  const byStaffNo = new Map(ROWS.map((r) => [r.staffNo, r]))

  const live = await db.employee.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, employeeNumber: true, jobTitle: true, category: true },
  })

  const planned: {
    id: string
    before: string
    changes: { field: string; was: string | null; now: string }[]
    how: string
  }[] = []
  const unmatched: string[] = []
  const used = new Set<string>()

  for (const emp of live) {
    const match = findMatch(emp.name, byStaffNo)
    if (!match) {
      unmatched.push(emp.name)
      continue
    }
    used.add(match.row.staffNo)

    const changes: { field: string; was: string | null; now: string }[] = []
    const name = intendedName(emp.name, match.row.staffNo)
    if (name !== emp.name) changes.push({ field: 'Name', was: emp.name, now: name })
    if (emp.employeeNumber !== match.row.staffNo) {
      changes.push({ field: 'Staff number', was: emp.employeeNumber, now: match.row.staffNo })
    }
    if (emp.jobTitle !== match.row.designation) {
      changes.push({ field: 'Job title', was: emp.jobTitle, now: match.row.designation })
    }
    if (emp.category !== match.row.category) {
      changes.push({ field: 'Category', was: emp.category, now: match.row.category })
    }
    if (changes.length > 0) planned.push({ id: emp.id, before: emp.name, changes, how: match.how })
  }

  console.log(apply ? '=== APPLYING ===\n' : '=== DRY RUN — nothing is being written ===\n')
  for (const p of planned) {
    console.log(`${p.before}   (${p.how})`)
    for (const c of p.changes) {
      console.log(`    ${c.field.padEnd(14)} ${JSON.stringify(c.was)}  ->  ${JSON.stringify(c.now)}`)
    }
  }

  if (unmatched.length > 0) {
    console.log(`\nNOT on the staff list — left completely untouched:`)
    for (const n of unmatched) console.log(`    ${n}`)
  }

  const missing = ROWS.filter((r) => !used.has(r.staffNo))
  console.log(`\nOn the staff list but not on this system at all: ${missing.length}`)
  console.log('    (this script never creates anyone — it only fills in records that exist)')

  console.log(`\n${planned.length} of ${live.length} records would change.`)

  if (!apply) {
    console.log('\nRe-run with --apply to write these changes.')
    await db.$disconnect()
    return
  }

  for (const p of planned) {
    const data: Record<string, string> = {}
    for (const c of p.changes) {
      data[
        { Name: 'name', 'Staff number': 'employeeNumber', 'Job title': 'jobTitle', Category: 'category' }[
          c.field
        ]!
      ] = c.now
    }
    await db.employee.update({ where: { id: p.id }, data })
  }
  console.log(`\nDone — ${planned.length} records updated.`)
  await db.$disconnect()
}

main()
