# Roadmap — Fleet Ops implementation batch

Five phases, agreed to build and test one before starting the next. This is
the durable record — chat scrolls away, this doesn't. Update it as phases
land or decisions change; don't let it drift from what's actually true.

Companion doc: [INVENTORY.md](INVENTORY.md) is "where does X live in the
code, today." This is "what are we building next, and why."

---

## PHASE A — Document types and fields cleanup

Small, schema-touching, done first because everything else depends on the
document model being right.

- [x] **A1 — Customer document types.** New list: `CR (Commercial
  Registration)`, `Commercial License`, `Computer Card`, `Other`. Old list
  (Trade License, Commercial Registration, VAT Certificate, Company ID / CR
  Extract, Insurance Certificate) retired. Existing rows migrated:
  `Trade License → Commercial License`, `Commercial Registration → CR
  (Commercial Registration)`, `Company ID / CR Extract → Computer Card`, `VAT
  Certificate → Other`, `Insurance Certificate → Other` (no equivalent).
  Migration: `prisma/migrations/20260815120000_document_type_cleanup`.
- [x] **A2 — Equipment document types.** New list: `Registration
  (Istimara)`, `Insurance`, `Load Test`, `3rd Party Certificate`, `Other`.
  Gate Pass removed (it belongs to the person on site, not the machine — see
  Phase B, where it comes back under Operator). Inspection Report removed
  (confirmed zero rows ever used it). Load Test Certificate renamed to Load
  Test. Existing Gate Pass rows migrated to Other.
- [x] **A3 — Document number, contextual label.** Investigated first, as
  asked: `documentNumber` is read in seven places, all display — nothing
  computes on its value (confirmed against warnings.ts and
  contract-warnings.ts specifically, since those are the logic files). One
  stored column, unchanged. Label now computed from the selected document
  type: `Insurance → Policy Number`, `3rd Party Certificate → Certificate
  Number`, `Registration (Istimara) → Registration Number`, else generic
  "Document number."
- [ ] **A4 — Permit/registration expiry cross-check.** Where a permit or
  sticker is recorded under Other on equipment, its expiry must not exceed
  that machine's Registration document's expiry. Validate on entry,
  non-blocking warning if exceeded — same pattern as the existing
  site/certificate checks. Not started; scoped separately from A1-A3 at the
  user's request.

## PHASE B — Third party certificates and site eligibility ✅ Done

Depended on Phase A and E0 (see below) — reordered 2026-08-15, then built.

**Sequencing decision**: E0 (Employee table) was originally the first step
of Phase E, gated behind Phase D. On closer read of the detailed HR spec,
that gate is narrower than it first looked — only **E3 (payroll)** is
gated behind D, because payroll reads timesheets. E0 itself has no
dependency on timesheets at all. Since B2 adds fields directly to the
Operator model, and E0 later folds Operator into a unified Employee table
anyway, building B2 on Operator now would mean doing that migration twice —
once to add the fields, once to move them to Employee. Confirmed with the
user there's no urgency on B3's QatarEnergy compliance check specifically,
so the decision is: **do E0 first, then build all of Phase B directly on
Employee.** E0 is smaller than a full rename suggests — Prisma model rename
with `@@map` to keep the physical table stable is a schema-file change plus
one small migration, not a rewrite.

- [x] **B1 — 3rd party certificate model.** Assessment and TPC/QE are
  separate records — the model already supported "one, both, or neither"
  (nothing stopped two `3rd Party Certificate` rows on one owner); the real
  gap was a field for which tier a given one is. `thirdPartyType`'s option
  list is now owner-specific, the same way `documentType` already is:
  equipment keeps its six existing values, operator's is exactly
  `Assessment | TPC/QE`. One existing operator row (`Operator Competency`)
  migrated to `TPC/QE`, following its own `approvedFor` signal
  (QATAR_ENERGY), not a default guess.
- [x] **B2 — Operator new fields.** Gate Pass, H2S Certificate, Defensive
  Driving Certificate added as operator document types — Gate Pass
  specifically completing the move A2 started. "Machines qualified to
  operate" needed real new structure: `OperatorQualification`, a join table,
  since equipment type is free text with suggestions, not a closed set.
  Built on `Employee` directly, per the E0 reorder below — no rework needed.
  First genuinely multi-value picker in the app
  ([`MultiCombobox`](src/components/ui/MultiCombobox.tsx)) — built as its
  own component rather than bent onto `Combobox`, whose `allowCustom` fires
  on every keystroke (correct for a single-value field, wrong for a
  discrete multi-add).
- [x] **B3 — Operator site eligibility.** QatarEnergy only — confirmed with
  the user rather than assumed, since the equipment-side certificate check
  covers three sites (QatarEnergy, Ras Laffan, Mesaieed) and this could
  easily have been read as the same list. It isn't. One warning per unmet
  requirement (TPC/QE specifically — Assessment alone insufficient — H2S,
  Defensive Driving), wired into both the live contract form and the
  contract detail page. Verified against a real contract already in the
  system (Lusail Boulevard / Rajesh Kumar) that genuinely had none of the
  three on file.

**Sequencing decision (2026-08-15)**: E0 (Employee table) was originally
the first step of Phase E, gated behind Phase D. On closer read of the
detailed HR spec, that gate is narrower than it first looked — only
**E3 (payroll)** is gated behind D, because payroll reads timesheets. E0
itself has no dependency on timesheets at all. Since B2 adds fields
directly to the Operator model, and E0 later folds Operator into a unified
Employee table anyway, building B2 on Operator would have meant doing that
migration twice. Confirmed with the user there was no urgency on B3's
compliance check specifically, so E0 was pulled forward and built first —
see below.

## PHASE C — Document file upload

No dependency on B. Can run parallel to or right after Phase A. Not started.

- PDF/image upload on every document record (customer, equipment, operator).
- Store via Vercel Blob, URL kept on the document row.
- View/download from the document list.
- Replace a file without losing the record's history.

## PHASE D — Timesheets (own build cycle)

Not started. **User has real timesheet examples to share when this starts** —
same approach as the invoice work (built and verified against real invoices
photographed and pasted in, not assumed). Ask before beginning.

**The core fact driving this module**: the billable amount is not the
machine rate alone — it's the machine rate applied against operator-
submitted, client-signed timesheets. The signature is what makes a sheet
billable.

**Two separate timesheets, never derived from each other**:
- Equipment timesheet → drives invoicing.
- Operator timesheet → drives payroll.
- Usually the same numbers, sometimes not. Must be separate records.

**Header** (every timesheet): reference number (auto, sequential),
month/period, customer, project + site, contract ref + LPO number, equipment
(unit name, type, plate/serial), operator (name, ID), company logo.

**Daily rows**, one per calendar day, auto-generated: Date, Day, Start,
Finish, Working hrs, Idle/standby hrs, Breakdown hrs, Remarks. Distinguishing
working from idle from breakdown matters — breakdown is typically not
billable, and a signed sheet showing that is what prevents disputes.

**Auto-fill defaults** (all editable; the entered value is what's stored and
used downstream — never the default):
- Equipment sheet: 10 hrs/working day, 0 on Friday.
- Operator sheet: 10 hrs/day when assigned to equipment, 8 hrs/day when not,
  0 on Friday.
- Vacation days show as 0, marked distinctly as vacation — not absence, not
  unworked.

**Footer**: total working/idle/breakdown hours. Signature blocks: operator,
client site representative, company representative. Date signed.

**Downstream rules — these produce two different numbers**:
- Invoicing reads the *equipment* timesheet, applies the contractual
  10hr/day minimum. Site worked 8 → invoice still reads 10.
- Payroll reads the *operator* timesheet at actual hours. Worked 8 → paid 8.
  No automatic overtime. Payroll never inherits the billed figure.
- Build both to read hours from one defined source each — exactly the
  pattern already in place for invoicing
  ([`src/lib/hours.ts`](src/lib/hours.ts)'s `hoursFor()`, currently an
  estimate). When real timesheet data arrives, only that source's body
  changes; invoice and payroll logic don't get rewritten. Payroll needs the
  equivalent single-source treatment when it's built.

**Output**: export to PDF for client signature, export to spreadsheet, mark
Signed/Approved before it can be invoiced against.

## PHASE E — HR and payroll foundation

The largest piece. Blocked on Phase D — payroll consumes timesheet data.
Two decisions already made (not open questions anymore):

- **H2S and Defensive Driving are two separate document records.** Never
  combined.
- **Operators become a subtype of a single Employee table**, not a separate
  table.

Everything below is grounded in Qatar Labour Law (Law No. 14 of 2004 and
amendments). Figures marked statutory are legal *minimums* — the company may
pay above, never below.

### Build order

1. **E0 — Employee table migration.** Structural, must come first.
2. **E1 — Documents and certifications.** Reuses the existing pattern, fast.
3. **E2 — Leave management.** Needed before payroll can be correct.
4. **E3 — Payroll and WPS export.** The largest single piece. Do not start
   until Phase D (timesheets) is working — payroll reads from it.
5. **E4 — Gratuity accrual.**
6. **E5 — Air tickets.**
7. **E6 — Later, scope with client, do not build now:** onboarding/exit
   checklists, performance records, self-service portal, recruitment,
   training beyond certifications, accommodation/camp management, GRSIA
   pension (only if the company employs Qatari nationals — confirm first).

### E0 — Employee table (structural, first) ✅ Done

Built ahead of Phase B, not held for Phase D — see the sequencing decision
above. Physical table kept as `Operator` (`@@map`), so this landed as one
additive column plus a Prisma-model rename, not a data migration. UI, routes
and nav are untouched — still "Operators" throughout, since nothing yet
exposes the other five categories. Every read that used to get "only
operators" for free now filters explicitly on `category: 'OPERATOR'`.

`Operator` becomes `Employee` with a `category` field. Operator assignments
reference an Employee whose category is Operator. Reason: payroll, leave and
gratuity run across the *whole* workforce — mechanics, admin, helpers need
payroll but never appear on a contract. Two tables means every one of those
processes runs twice and has to stay in sync.

Categories: Operator, Driver, Mechanic/Workshop, Helper/Labourer,
Admin/Office, Management.

**Employee record fields** —
*Identity/employment*: Employee ID, full name (English **and** Arabic — Arabic
needed for WPS and Ministry filings), nationality, DOB, category, job title,
department, date of joining, status (Active/On leave/Exited), date of exit,
contract type (fixed term/unlimited), probation end date, sponsor/
establishment (if the group has more than one CR).
*Contact*: phone, personal email, accommodation/camp location, emergency
contact name+number, home country address (needed for exit and ticket
entitlement).
*Payroll identifiers*: bank name, IBAN or wage card number, QID (or Visa ID
for those without one yet).
*Operator/Driver-specific, shown conditionally*: machines qualified to
operate (multi-select), links to E1 certification documents.

**Migration**: existing Operator rows → Employee with `category = Operator`.
Keep assignment links intact. Report anything that fails to map — same
"report, don't guess" pattern as A1's document type migration.

### E1 — Employee documents and certifications

Reuses the existing document-with-expiry pattern and alerting (same as
customer/equipment). Every type below needs expiry tracking, file upload
(Phase C), and the same warning behaviour.

*Legal and identity — compliance-critical, an expiry here can stop a man
working*: Qatar ID (QID), Passport, Visa/Residence Permit, Employment
Contract, Medical Certificate/Health Card.
*Competency and site access*: Driving License, Operator License, 3rd Party
Certificate — Assessment, 3rd Party Certificate — TPC/QE, H2S Certificate,
Defensive Driving Certificate, Gate Pass (project-specific), Other.

Rules: Assessment and TPC/QE are separate records (one, both, or neither).
H2S and Defensive Driving separate, never combined. **QID and Visa expiry
escalate harder than other documents** — an expired QID is a legal exposure,
not an administrative one.

### E2 — Leave management

**Statutory entitlements**:
- **Annual leave (Art. 79)** — eligible after 1 full year continuous
  service. Minimum 3 weeks/year under 5 years' service, 4 weeks at 5+ years.
  Pro-rated for partial years.
- **Sick leave (Art. 82)** — eligible after 3 months, needs a medical
  certificate from an approved physician. First 2 weeks full pay, next 4
  weeks half pay, remainder unpaid.
- **Hajj leave** — 20 days unpaid, once per employee's service, Muslim
  employees. Company sets how many may take it per year; priority to
  longest service.
- **Maternity leave** — 50 days, at least 35 after delivery.
- **Public holidays** — Eid Al Fitr, Eid Al Adha, Qatar National Day, other
  declared days. A public holiday falling inside annual leave does not
  consume a leave day — leave extends by that day. Build this into the
  calculation, don't just document it.

**Features**: leave types (Annual, Sick [full/half/unpaid tiers], Unpaid,
Hajj, Maternity, Emergency, Public Holiday); entitlement per employee,
defaulting to statutory by service length, overridable where the company
pays more; accrual and running balance; carry-over up to half of annual
leave into the following year; request/approval flow; leave calendar
(filterable by category and site); **leave encashment** — unused annual
leave paid out on exit, system calculates the balance owed.

**Downstream effects**: feeds timesheet auto-fill (a leave day shows as
leave, not absence/unworked). **Unpaid leave is excluded from continuous
service for gratuity purposes; paid annual leave is included** — this
distinction must be stored correctly or gratuity comes out wrong.

### E3 — Payroll

**Salary structure per employee**: basic, allowances (housing, transport,
food, site, other), recurring deductions (advances, loans, fines).

**Statutory minimum wage** (Law No. 17 of 2020, effective March 2021): QAR
1,000 basic + QAR 500 housing + QAR 300 food where not provided in kind.
Validate on entry, warn if below.

**Critical rule: gratuity, overtime and leave pay are calculated on basic
salary only — never total package including allowances.** Basic must be its
own stored field, and every downstream calculation must read that field, not
gross. This is the single easiest thing to get wrong in this whole module.

**Working hours and overtime (statutory)**:
- Standard: 8 hrs/day, 48 hrs/week.
- **Ramadan: 6 hrs/day, 36 hrs/week, no pay reduction** — payroll must apply
  this automatically for the Ramadan period.
- Daily hours may extend to 10 only where the extra 2 are paid as overtime.
- Overtime rate: minimum 125% of basic hourly rate.
- Night work (9pm-6am): minimum 150%.
- Rest day or public holiday work: 150% + a compensatory day off.
- Overtime capped at 2 hrs/day except emergencies.
- One rest day/week, normally Friday.

**Open compliance question, flagged by the user**: the operator default of
10 hrs/day means the last 2 hours are legally overtime. Confirm with the
client how they currently treat this — it's a compliance exposure if those
hours are being paid flat. (See open questions below, #4.)

**Payroll run**: monthly, reads operator and employee timesheets at actual
hours. **Never inherits the billed figure** — equipment billed at the
10-hour contractual minimum, operator worked 8, payroll pays 8. Applies
overtime rules, leave pay, deductions. Payslip PDF per employee. Payroll
register export for accounts.

**WPS export — mandatory.** Salaries must go through the Wage Protection
System via an approved bank; the system must generate a Salary Information
File (SIF) in the bank's required format.
- SIF: structured CSV, header section (employer establishment + computer
  card details), one record per employee.
- Per-employee record: sequence number, QID (or Visa ID), name, IBAN/wage
  card, salary period start/end, basic, allowances, deductions, net payable.
- Wages transferred within the statutory window after the pay period.
- **Build note**: exact SIF field layout varies by bank — get the actual
  spec from the company's bank before building the export, and build the
  format as configuration, not hardcoded, so a bank change doesn't need a
  code change.
- **Pre-submission validation is where the value is**: check every employee
  has a valid QID/Visa ID and valid IBAN before generating the file. Block
  the export with a clear list of what's missing, rather than producing a
  file the bank will reject.

### E4 — End of service gratuity

Build as a running accrual, not just a figure calculated at exit — it's a
real liability the business carries and should stay visible.

Eligibility: 1 full year continuous service; below that, none.

**Formula (Art. 54, statutory minimum)**:
```
Gratuity = (Basic salary ÷ 30) × 21 × years of service
```
21 days of basic pay per year of service. Company may pay above, not below.

Rules: basic salary only, allowances excluded. Paid annual leave counts
toward continuous service; unpaid leave is deducted from it. Pro-rated for
partial years. **Forfeited where termination falls under Article 61 (serious
misconduct)** — build this as a flag on the exit record with a reason, never
an automatic decision.

Build: running accrued liability per employee, visible on the employee
record; total accrued liability across the workforce as a management
figure; final settlement calc on exit = gratuity + unused leave encashment +
outstanding dues − deductions.

### E5 — Air ticket entitlement

Contractual, not statutory — but standard for expatriate staff and a common
source of dispute. Entitlement cycle per employee (commonly 1 or 2 years);
track last ticket taken/allowance paid and next entitlement date; whether
entitlement is a ticket in kind or cash allowance; alert when due, especially
if it coincides with planned annual leave.

### Qatar-specific items — confirm with client before building

- **End of service gratuity** — accrued liability per employee (E4, above).
- **WPS** — payroll must export in the bank's required SIF format.
- **Residence permit / QID expiry** — hard compliance item, same alerting
  tier as other documents, escalated harder (E1).
- **Annual leave entitlement** under Qatar Labour Law, and how the company
  actually applies it (statutory floor vs. what they actually give).
- **Air ticket allowance** — entitlement cycle per employee.

### Open questions — need answers before building the relevant piece

1. Do they employ any Qatari nationals? Determines whether GRSIA pension
   contributions are needed (E6).
2. Which bank for WPS? The SIF format spec must come from that bank (E3).
3. Do they pay above statutory minimums anywhere — gratuity above 21 days,
   annual leave above 3 weeks? System should default to statutory, allow
   per-employee override (E4, E2).
4. How are the 2 hours beyond the standard 8-hour day currently paid for
   operators — flat, or at overtime rate? (E3 — compliance-relevant.)
5. Air ticket entitlement cycle — every 1 year or 2, ticket or cash? (E5.)
6. Is accommodation/food provided in kind or paid as allowance? Affects
   minimum wage compliance checking (E3).
7. *(Carried from the original Phase B doc, now resolved)* ~~H2S and
   Defensive Driving — one certificate or two?~~ **Answered: two separate
   records.**
8. *(Carried from the original Phase B doc, now resolved)* ~~Operators vs
   Employees — one table or two?~~ **Answered: single Employee table with a
   category field.**
