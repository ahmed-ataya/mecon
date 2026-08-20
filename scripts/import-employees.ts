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
import type { EmployeeCategory } from '../src/lib/enums'

type Row = { staffNo: string; name: string; designation: string; category: EmployeeCategory }

const ROWS: Row[] = [
  { staffNo: '5404', name: 'Mohamed Fawzul', designation: 'WS Supervisor', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5459', name: 'Mohammed Shalin', designation: 'Camp Boss', category: 'MANAGEMENT' },
  { staffNo: '5257', name: 'Poovanakanth', designation: 'Transport Driver', category: 'DRIVER' },
  { staffNo: '5419', name: 'Raynard Mohideen', designation: 'Transport Driver', category: 'DRIVER' },
  { staffNo: '5436', name: 'Rajarama Kukkada', designation: 'Head Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '6008', name: 'Thiyagarajan Kandasami', designation: 'Auto Electrician', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5417', name: 'Mohammad Mustakim', designation: 'Auto Electrician', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5069', name: 'Dumindu Lakmal', designation: 'Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5384', name: 'Abdul Karimu Adam', designation: 'Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5385', name: 'Samuel Boamah', designation: 'Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5446', name: 'Chulani Nisantha', designation: 'Painter', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5433', name: 'Musyafi Akhwan', designation: 'Welder', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5457', name: 'Primali Sanjeewa', designation: 'Welder', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5424', name: 'Paramjit Lal', designation: 'Tire Man', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5197', name: 'Kwabena Kundale', designation: 'Wash Man/Helper', category: 'HELPER_LABOURER' },
  { staffNo: '5369', name: 'Mohammad Sofian', designation: 'Accounts', category: 'ADMIN_OFFICE' },
  { staffNo: '5141', name: 'Abdelhadi Yassin', designation: 'PRO', category: 'ADMIN_OFFICE' },
  { staffNo: '5410', name: 'Mohammad Shanu', designation: 'Sales/Ops Manager', category: 'MANAGEMENT' },
  { staffNo: '5412', name: 'Mohamed Asath', designation: 'Office Boy', category: 'ADMIN_OFFICE' },
  { staffNo: '5429', name: 'Moitheen Khan', designation: 'Logistic Coordinator', category: 'ADMIN_OFFICE' },
  { staffNo: '5092', name: 'Kashyapa Indika', designation: 'Backhoe Loader', category: 'OPERATOR' },
  { staffNo: '5135', name: 'Ramesh Kandel', designation: 'Backhoe Loader', category: 'OPERATOR' },
  { staffNo: '5421', name: 'Abeywardhana', designation: 'Backhoe Loader', category: 'OPERATOR' },
  { staffNo: '5014', name: 'Ajay Shrestha', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '5016', name: 'Vim Bahadur Bharati', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '5042', name: 'Laxmi Prasad', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '5166', name: 'Ram Ekabal', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '6015', name: 'Kailash Raut', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5064', name: 'Chandana Samantha', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5357', name: 'Samin Miya', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5422', name: 'Sashintha Dilhan', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5461', name: 'Kiran Limbu', designation: 'Lowbed/Boom Truck', category: 'OPERATOR' },
  { staffNo: '5354', name: 'Sanjoy George', designation: 'Mini Excavator', category: 'OPERATOR' },
  { staffNo: '5426', name: 'Nalin Wasantha', designation: 'Motor Grader', category: 'OPERATOR' },
  { staffNo: '5288', name: 'Tara Majhi', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5312', name: 'Bijaya Tawa', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5316', name: 'Baburam Adhikari', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5318', name: 'Padam Bahadur Poudel', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5320', name: 'Prem Niraula', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5322', name: 'Niraj Pariyar', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5400', name: 'Shailendra Kumar', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5455', name: 'Ram Kumar Kunwar', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5456', name: 'Sendilnanan', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5458', name: 'Raj Kumar Nembang', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5454', name: 'Latif Gul', designation: 'Telehandler', category: 'OPERATOR' },
  { staffNo: '5145', name: 'Basanta Adhikari', designation: 'Telehandler', category: 'OPERATOR' },
  { staffNo: '5463', name: 'Ram Ashish', designation: 'Telehandler/Forklift', category: 'OPERATOR' },
  { staffNo: '5453', name: 'Mohamed Ismath', designation: 'WS Office Boy', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '7001', name: 'Nashan Nasar', designation: 'Helper', category: 'HELPER_LABOURER' },
  { staffNo: '7002', name: 'Mohammed Zoomi', designation: 'Helper', category: 'HELPER_LABOURER' },
]

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
