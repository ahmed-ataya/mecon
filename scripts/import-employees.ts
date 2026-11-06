/**
 * One-off import of the real staff list (50 people), supplied 2026-08-18 as
 * "Employe List.xlsx" — not a standing app feature, run once via:
 *
 *   npx tsx scripts/import-employees.ts
 *
 * Idempotent on employeeNumber: an existing row with the same staff number
 * is left untouched (updated only if run again after a correction), so this
 * is safe to re-run. Never touches the pre-existing demo employees
 * (Mohammed Ashraf, Rajesh Kumar, Sunil Prasad, etc.) — none of their names
 * match anyone in this list, and several are tied to real contract/
 * assignment/invoice history built up over this whole session.
 *
 * DESIGNATION -> category is a judgment call for anything that isn't an
 * obvious equipment name or "driver" — confirm with the business if any of
 * these read wrong:
 *   - CAMP BOSS -> MANAGEMENT (oversees the labour camp, a supervisory role)
 *   - SALES/OPS MANAGER -> MANAGEMENT
 *   - WS SUPERVISOR, HEAD MECHANIC, AUTO ELECTRICIAN, MECHANIC, PAINTER,
 *     WELDER, TIRE MAN -> MECHANIC_WORKSHOP (skilled workshop trades)
 *   - WASH MAN/HELPER -> HELPER_LABOURER (general labour, not a trade)
 *   - WS OFFICE BOY -> MECHANIC_WORKSHOP (the "WS" prefix ties them to the
 *     workshop team specifically, distinct from the general OFFICE BOY)
 *   - ACCOUNTS, PRO, OFFICE BOY, LOGISTIC Coordinator -> ADMIN_OFFICE
 *   - Helper -> HELPER_LABOURER
 *   - Every machine-name designation (Backhoe Loader, Boom Truck,
 *     Excavator, Skid Loader, Telehandler, ...) -> OPERATOR
 */
import 'dotenv/config' // runs as its own process, so it loads .env itself
import { db } from '../src/lib/db'

import { ROWS } from './staff-list'


async function main() {
  let created = 0
  let skipped = 0

  for (const row of ROWS) {
    const existing = await db.employee.findFirst({
      where: { employeeNumber: row.staffNo },
    })

    if (existing) {
      console.log(`Skip ${row.staffNo} ${row.name} — already exists (${existing.id})`)
      skipped += 1
      continue
    }

    await db.employee.create({
      data: {
        employeeNumber: row.staffNo,
        name: row.name,
        jobTitle: row.designation,
        category: row.category,
        source: 'IN_HOUSE',
      },
    })
    created += 1
  }

  console.log(`\nCreated ${created}, skipped ${skipped} (already present), out of ${ROWS.length} rows.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
