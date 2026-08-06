import 'dotenv/config' // seed runs as its own process, so it loads .env itself
import { db } from '../src/lib/db'

/**
 * Realistic sample data for local development.
 *
 * Three problems are seeded deliberately, so the expiry and site-approval
 * logic has something to catch from day one:
 *
 *   1. Al Bandary Contracting — Trade License expired 12 Jun 2026
 *   2. Rajesh Kumar — Medical Certificate expired 20 Jul 2026
 *   3. CAT 320 #4 — 3rd Party Certificate approved for General Doha only,
 *      so it fails the check on any QatarEnergy / Ras Laffan / Mesaieed site
 *
 * A couple of documents also sit inside the 30-day expiring-soon window so the
 * amber state is visible, not just red and green.
 */

/** Date-only values are stored at UTC midnight — see src/lib/dates.ts */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

async function main() {
  // This script DESTROYS all existing data. That was harmless when the only
  // database was a local dev.db, but the app is now deployed and someone may
  // have entered real records. Refuse to run against a database that already
  // has data unless the caller explicitly opts in with FORCE_SEED=1.
  const existing = await db.customer.count()

  if (existing > 0 && process.env.FORCE_SEED !== '1') {
    console.error(
      `\nRefusing to seed: the target database already has ${existing} customer(s).\n` +
        `Seeding deletes EVERY record — customers, equipment, operators, documents,\n` +
        `contracts and invoices.\n\n` +
        `Check DATABASE_URL points where you think it does. If you really do want\n` +
        `to wipe it, re-run with FORCE_SEED=1.\n`,
    )
    process.exitCode = 1
    return
  }

  // Wipe in dependency order so the seed can be re-run at any time.
  await db.invoiceLineItem.deleteMany()
  await db.invoice.deleteMany()
  await db.equipmentAssignment.deleteMany()
  await db.operatorAssignment.deleteMany()
  await db.contract.deleteMany()
  await db.documentApproval.deleteMany()
  await db.document.deleteMany()
  await db.customer.deleteMany()
  await db.equipment.deleteMany()
  await db.operator.deleteMany()

  // --- Customers ----------------------------------------------------------

  const alBandary = await db.customer.create({
    data: {
      name: 'Al Bandary Contracting W.L.L.',
      contactPerson: 'Khalid Al Bandary',
      phone: '+974 4443 8812',
      email: 'operations@albandary-contracting.qa',
      notes: 'Long-standing customer. Mostly infrastructure work around Doha.',
      documents: {
        create: [
          {
            ownerType: 'CUSTOMER',
            // PROBLEM 1: expired trade license
            documentType: 'Trade License',
            documentNumber: 'TL-58211',
            issueDate: d('2025-06-13'),
            expiryDate: d('2026-06-12'),
          },
          {
            ownerType: 'CUSTOMER',
            documentType: 'Commercial Registration',
            documentNumber: 'CR-104882',
            issueDate: d('2026-02-01'),
            expiryDate: d('2027-01-31'),
          },
          {
            ownerType: 'CUSTOMER',
            documentType: 'VAT Certificate',
            documentNumber: 'VAT-99120',
            issueDate: d('2026-01-15'),
            expiryDate: null, // no expiry on this one
          },
        ],
      },
    },
  })

  const qatariDiar = await db.customer.create({
    data: {
      name: 'Qatari Diar Construction',
      contactPerson: 'Fahad Al Marri',
      phone: '+974 4402 7700',
      email: 'procurement@qatari-diar-const.qa',
      notes: 'Works QatarEnergy and Ras Laffan sites — strict certificate rules.',
      documents: {
        create: [
          {
            ownerType: 'CUSTOMER',
            documentType: 'Trade License',
            documentNumber: 'TL-33017',
            issueDate: d('2026-03-01'),
            expiryDate: d('2027-02-28'),
          },
          {
            ownerType: 'CUSTOMER',
            documentType: 'Insurance Certificate',
            documentNumber: 'INS-77410',
            issueDate: d('2025-09-01'),
            // expiring soon — inside the 30-day amber window
            expiryDate: d('2026-08-28'),
          },
        ],
      },
    },
  })

  const midmac = await db.customer.create({
    data: {
      name: 'Midmac Contracting Co.',
      contactPerson: 'Youssef Haddad',
      phone: '+974 4468 1200',
      email: 'plant@midmac.qa',
      notes: 'Rents without operators — they supply their own crew.',
      documents: {
        create: [
          {
            ownerType: 'CUSTOMER',
            documentType: 'Trade License',
            documentNumber: 'TL-71904',
            issueDate: d('2026-05-10'),
            expiryDate: d('2027-05-09'),
          },
          {
            ownerType: 'CUSTOMER',
            documentType: 'Company ID / CR Extract',
            documentNumber: 'CRX-22087',
            issueDate: d('2026-04-02'),
            expiryDate: d('2027-04-01'),
          },
        ],
      },
    },
  })

  // --- Equipment ----------------------------------------------------------

  const cat320 = await db.equipment.create({
    data: {
      name: 'CAT 320 #4',
      type: 'Excavator',
      serialNumber: 'CAT0320ELKGF04412',
      plateNumber: '218844',
      notes: 'General Doha work only until the certificate is re-issued.',
      documents: {
        create: [
          {
            ownerType: 'EQUIPMENT',
            documentType: 'Registration (Istimara)',
            documentNumber: 'IST-218844',
            issueDate: d('2026-01-20'),
            expiryDate: d('2027-01-19'),
          },
          {
            ownerType: 'EQUIPMENT',
            documentType: 'Insurance',
            documentNumber: 'EQINS-40122',
            issueDate: d('2025-11-01'),
            expiryDate: d('2026-10-31'),
          },
          {
            ownerType: 'EQUIPMENT',
            // PROBLEM 3: valid certificate, but General Doha only
            documentType: '3rd Party Certificate',
            documentNumber: 'BV-QA-88231',
            issueDate: d('2026-02-14'),
            expiryDate: d('2027-02-13'),
            thirdPartyType: 'Lifting Equipment Cert',
            issuingCompany: 'Bureau Veritas',
            approvedFor: { create: [{ body: 'GENERAL_DOHA' }] },
          },
        ],
      },
    },
  })

  const komatsuWA380 = await db.equipment.create({
    data: {
      name: 'Komatsu WA380 #2',
      type: 'Wheel Loader',
      serialNumber: 'KMTWA380A78N10233',
      plateNumber: '304115',
      notes: 'Cleared for QatarEnergy and Ras Laffan.',
      documents: {
        create: [
          {
            ownerType: 'EQUIPMENT',
            documentType: 'Registration (Istimara)',
            documentNumber: 'IST-304115',
            issueDate: d('2026-03-05'),
            expiryDate: d('2027-03-04'),
          },
          {
            ownerType: 'EQUIPMENT',
            documentType: '3rd Party Certificate',
            documentNumber: 'SGS-QA-11907',
            issueDate: d('2026-01-10'),
            expiryDate: d('2027-01-09'),
            thirdPartyType: 'Lifting Equipment Cert',
            issuingCompany: 'SGS Qatar',
            approvedFor: {
              create: [
                { body: 'GENERAL_DOHA' },
                { body: 'QATAR_ENERGY' },
                { body: 'RAS_LAFFAN' },
              ],
            },
          },
          {
            ownerType: 'EQUIPMENT',
            documentType: 'Load Test Certificate',
            documentNumber: 'LT-2026-338',
            issueDate: d('2026-06-01'),
            expiryDate: d('2027-05-31'),
          },
        ],
      },
    },
  })

  const jcb3cx = await db.equipment.create({
    data: {
      name: 'JCB 3CX #7',
      type: 'Backhoe Loader (JCB)',
      serialNumber: 'JCB3CX4TSJ2661077',
      plateNumber: '277301',
      documents: {
        create: [
          {
            ownerType: 'EQUIPMENT',
            documentType: 'Registration (Istimara)',
            documentNumber: 'IST-277301',
            issueDate: d('2025-08-20'),
            // expiring soon — amber
            expiryDate: d('2026-08-19'),
          },
          {
            ownerType: 'EQUIPMENT',
            documentType: '3rd Party Certificate',
            // Recorded as a deliberate "does not apply" rather than left blank,
            // so it reads as a decision instead of missing data.
            isApplicable: false,
            thirdPartyType: 'Lifting Equipment Cert',
          },
        ],
      },
    },
  })

  const bobcatS570 = await db.equipment.create({
    data: {
      name: 'Bobcat S570 #1',
      type: 'Skid Steer (Bobcat)',
      serialNumber: 'B5700N1A9M2288401',
      plateNumber: '190228',
      notes: 'Small footprint — used for interior and confined site work.',
      documents: {
        create: [
          {
            ownerType: 'EQUIPMENT',
            documentType: 'Insurance',
            documentNumber: 'EQINS-51188',
            issueDate: d('2026-04-15'),
            expiryDate: d('2027-04-14'),
          },
          {
            ownerType: 'EQUIPMENT',
            documentType: '3rd Party Certificate',
            documentNumber: 'TUV-QA-55012',
            issueDate: d('2026-05-02'),
            expiryDate: d('2027-05-01'),
            thirdPartyType: 'Vehicle Inspection',
            issuingCompany: 'TÜV Rheinland',
            approvedFor: {
              create: [{ body: 'GENERAL_DOHA' }, { body: 'MESAIEED' }],
            },
          },
        ],
      },
    },
  })

  // --- Operators ----------------------------------------------------------

  const rajesh = await db.operator.create({
    data: {
      name: 'Rajesh Kumar',
      phone: '+974 5541 2298',
      nationality: 'Indian',
      source: 'IN_HOUSE',
      notes: 'Excavator specialist. 9 years with the company.',
      documents: {
        create: [
          {
            ownerType: 'OPERATOR',
            documentType: 'Qatar ID',
            documentNumber: '28935604412',
            issueDate: d('2025-10-01'),
            expiryDate: d('2027-09-30'),
          },
          {
            ownerType: 'OPERATOR',
            // PROBLEM 2: expired medical certificate
            documentType: 'Medical Certificate',
            documentNumber: 'MED-2025-8841',
            issueDate: d('2025-07-21'),
            expiryDate: d('2026-07-20'),
          },
          {
            ownerType: 'OPERATOR',
            documentType: 'Operator License',
            documentNumber: 'OPL-33188',
            issueDate: d('2026-01-05'),
            expiryDate: d('2028-01-04'),
          },
        ],
      },
    },
  })

  const ashraf = await db.operator.create({
    data: {
      name: 'Mohammed Ashraf',
      phone: '+974 5588 7014',
      nationality: 'Pakistani',
      source: 'IN_HOUSE',
      documents: {
        create: [
          {
            ownerType: 'OPERATOR',
            documentType: 'Qatar ID',
            documentNumber: '29014778230',
            issueDate: d('2026-02-11'),
            expiryDate: d('2028-02-10'),
          },
          {
            ownerType: 'OPERATOR',
            documentType: 'Medical Certificate',
            documentNumber: 'MED-2026-1120',
            issueDate: d('2026-03-01'),
            expiryDate: d('2027-02-28'),
          },
          {
            ownerType: 'OPERATOR',
            documentType: '3rd Party Certificate',
            documentNumber: 'BV-OC-77219',
            issueDate: d('2026-04-18'),
            expiryDate: d('2027-04-17'),
            thirdPartyType: 'Operator Competency',
            issuingCompany: 'Bureau Veritas',
            approvedFor: {
              create: [{ body: 'GENERAL_DOHA' }, { body: 'QATAR_ENERGY' }],
            },
          },
        ],
      },
    },
  })

  const sunil = await db.operator.create({
    data: {
      name: 'Sunil Prasad',
      phone: '+974 3320 9945',
      nationality: 'Nepali',
      source: 'MARKET',
      notes: 'Subcontracted through Gulf Manpower. Re-billed to customer.',
      documents: {
        create: [
          {
            ownerType: 'OPERATOR',
            documentType: 'Qatar ID',
            documentNumber: '29188340175',
            issueDate: d('2025-12-01'),
            expiryDate: d('2027-11-30'),
          },
          {
            ownerType: 'OPERATOR',
            documentType: 'Driving License',
            documentNumber: 'DL-6612094',
            issueDate: d('2025-09-14'),
            // expiring soon — amber
            expiryDate: d('2026-09-13'),
          },
        ],
      },
    },
  })

  console.log('Seeded:')
  console.log(`  customers  ${[alBandary, qatariDiar, midmac].length}`)
  console.log(
    `  equipment  ${[cat320, komatsuWA380, jcb3cx, bobcatS570].length}`,
  )
  console.log(`  operators  ${[rajesh, ashraf, sunil].length}`)
  console.log('')
  console.log('Deliberate problems:')
  console.log('  Al Bandary Contracting — Trade License expired 12 Jun 2026')
  console.log('  Rajesh Kumar — Medical Certificate expired 20 Jul 2026')
  console.log('  CAT 320 #4 — 3rd party cert approved for General Doha only')
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await db.$disconnect()
    process.exit(1)
  })
