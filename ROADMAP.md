# Roadmap — Fleet Ops implementation batch

Five phases, agreed to build and test one before starting the next. This is
the durable record — chat scrolls away, this doesn't. Update it as phases
land or decisions change; don't let it drift from what's actually true.

Companion doc: [INVENTORY.md](INVENTORY.md) is "where does X live in the
code, today." This is "what are we building next, and why."

---

## PHASE A — Document types and fields cleanup ✅ Done

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
- [x] **A4 — Permit/registration expiry cross-check.** Built in `c42f381`,
  right after this roadmap was first written — this checkbox just never got
  updated to match (found and fixed 2026-08-17 while starting the next
  phase). Where a permit or sticker is recorded under Other on equipment,
  its expiry must not run past that machine's own Registration (Istimara)
  expiry. One direction only: a non-Other document (3rd Party Certificate,
  Insurance) outliving Registration is not flagged — confirmed live against
  Wheel Excavator #4's actual 3rd Party Certificate, which does run past its
  Registration and correctly stays quiet. Silent whenever there's nothing to
  compare against (no applicable Registration on file, or one with no
  expiry). One shared comparison
  ([`permitExceedsRegistration`](src/lib/equipment-warnings.ts)), checked in
  two places so they can't drift apart: live as it's entered
  (`DocumentForm`, clears the moment the date stops crossing the line) and
  standing on the equipment page (`permitExceedsRegistrationWarnings`, via
  the same `WarningList` component B3 uses). Verified against real data
  already in the system: the Gate Pass row A2 migrated to Other on Wheel
  Excavator #4 turned out to already exceed that machine's Registration
  expiry (22 Feb 2027 vs 19 Jan 2027) — a real instance of exactly what this
  rule exists to catch, not a manufactured test case.

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

## PHASE C — Document file upload ✅ Done

No dependency on B. Built right after Phase B, per the original plan.

- [x] **Schema.** `Document.filePath` — added in an earlier phase for a local
  `storage/` directory, never actually wired up (see NOTES.md on why that
  approach was abandoned) — replaced with `fileUrl`, `fileName`, `fileType`.
  Migration `20260815170000_document_file_upload`.
- [x] **Upload path.** The browser uploads straight to Vercel Blob via
  `@vercel/blob/client`'s `upload()`, not through the create/update Server
  Action. Reason: Next.js caps a Server Action body at 1MB by default, and
  Vercel's serverless functions carry their own hard ceiling on top of that
  regardless of config — both well under what a scanned certificate or a
  phone photo of one produces. A route handler
  ([`src/app/api/documents/upload/route.ts`](src/app/api/documents/upload/route.ts))
  issues a scoped, short-lived client token via `handleUpload`; the file
  bytes never touch a Next.js function at all. Once the browser upload
  finishes, the resulting URL rides into the existing `createDocument`/
  `updateDocument` actions as three hidden form fields — no change to how
  those actions are invoked or validated otherwise.
- [x] **Allowed types and size.** PDF or image, up to 20MB — see
  `DOCUMENT_FILE_ALLOWED_TYPES`/`DOCUMENT_FILE_MAX_BYTES` in `enums.ts`.
  Enforced twice: client-side before starting the upload (fast feedback,
  UX only), and server-side as a constraint on the issued Blob token (the
  real gate).
- [x] **View/download.** The store is **private** — Vercel no longer offers
  public stores for new accounts, and a real access check beats an
  unguessable-URL model anyway. So the raw Blob URL is useless without
  `BLOB_READ_WRITE_TOKEN`, which never leaves the server; the browser never
  sees it. A new route,
  [`src/app/api/documents/[id]/file/route.ts`](<src/app/api/documents/[id]/file/route.ts>),
  looks the file up by document id (never by a client-supplied URL) and
  streams it through, gated the same as everything else in the app — the
  review-gate password (`src/middleware.ts`). Both the document list row and
  the open edit form link there; `?download` forces a save-as instead of an
  inline view.
- [x] **Replace without losing history.** Replacing a file is an edit to the
  same `Document` row through the existing update form, not a new record —
  its type, dates, third-party fields etc. are untouched. The old blob is
  deleted server-side once the new URL is saved (`deleteBlob` in
  `src/lib/actions/documents.ts`), and likewise on delete, so replacing or
  removing a file never leaves orphaned storage behind. Best-effort: a Blob
  delete failure never blocks the save or delete that already succeeded in
  the database.

**Known gap**: if a user selects a replacement file and then cancels the form
instead of saving, the newly-uploaded blob has already landed in storage and
is now unreferenced — nothing sweeps that up. Accepted for now given this
app's scale and the lack of any background-job infrastructure to run a
cleanup pass; revisit if it turns out to matter in practice.

**New env var**: `BLOB_READ_WRITE_TOKEN` — see `.env.example` and DEPLOY.md.
Unlike `DATABASE_URL`, there's no local stand-in for Blob; local development
needs a real (separate) store too.

## PHASE B4 — Document fields, machine-specific certificates, profile completeness ✅ Done

Business feedback, 2026-08-17. Scoped and agreed in chat, recorded here before
building, same as every other phase. Migration
`20260817190750_document_other_notes_certified_type_employee_number`.

- [x] **F1 — "Other" document name.** `Document.otherLabel`. When Document
  type is Other, a required free-text name field appears (e.g. "Fire
  Extinguisher Certificate") so records under Other stop being
  indistinguishable from each other. All three owner types. Required only
  while Applicable is checked — same escape hatch the 3rd party fields
  already use, so a deliberate "doesn't apply" record can stay empty. The
  document list and edit form both show it in place of the bare word
  "Other" (`documentHeading()` in `DocumentsSection.tsx`).
- [x] **F2 — Document notes.** `Document.notes`. Free-text, every document
  record, every owner type, always available — not conditional on type.
- [x] **F3 — Employee number.** `Employee.employeeNumber`. Schema field
  only, as agreed — no UI reads or writes it yet; surfaces when Phase E
  (HR) is built.
- [x] **F4 — Machines qualified to operate.** Turned out to already exist —
  built in Phase B2 (`OperatorQualification`), shown on the Operator form
  as "Machines qualified to operate" with a multi-select. Confirmed while
  scoping this phase; no work needed.
- [x] **F5 — TPC/QE is machine-specific.** `Document.certifiedEquipmentType`
  — an operator can hold a separate 3rd party certificate per machine
  type — someone running a skid loader and a wheel loader needs two.
  Applies to Assessment and TPC/QE both, OPERATOR owner only; reuses the
  same equipment-type vocabulary as `OperatorQualification` and
  `Equipment.type`, via the same `Combobox` pattern. Multiple 3rd party
  certificates per operator already worked at the DB level (Phase B1) —
  this makes the multiplicity meaningful instead of ambiguous.

  The QatarEnergy site-eligibility check (`operatorSiteEligibilityWarnings`
  in `src/lib/warnings.ts`) now checks the operator holds a valid
  certificate for the SPECIFIC machine type being assigned, not merely any
  certificate — three distinct outcomes, each its own warning code:
  `OPERATOR_MISSING_TPC_QE` (none at all), `OPERATOR_TPC_QE_EXPIRED` (held
  for this exact machine, not currently valid), `OPERATOR_TPC_QE_WRONG_MACHINE`
  (held, but only for a different machine — named in the message).

  This check used to only show live in the contract creation form and
  passively on the contract detail page after saving — replacing an
  operator mid-contract showed no live warning at all. Now fires live in
  both replacement flows too:
  - Replacing the **operator** on a contract (`OperatorTimeline`) — the
    gap the user pointed out directly.
  - Replacing the **equipment** on a contract (`EquipmentTimeline`) — not
    explicitly asked for, but falls out of the same rule: swapping a crane
    for a different machine type mid-contract invalidates the current
    operator's certificate coverage exactly the same way. Confirmed in
    scope with the user before building.

  `OperatorOption.siteWarnings` (`src/lib/contract-options.ts`) went from
  one array per site to one array per site *per machine type currently in
  the fleet* — still computed server-side, same reasoning as before
  (raw documents never reach the browser). `EquipmentOption` gained a
  plain `type` field so the client has something to key that lookup with
  beyond the formatted `sublabel`.

  Verified live against real data already in the system, not a
  manufactured case: Rajesh Kumar (assigned to Lusail Boulevard, a
  QatarEnergy contract currently running a Crane) was given a TPC/QE
  certificate for Skid Loader. The contract detail page, the live
  operator-replace form, and the live equipment-replace form all
  correctly read *"holds a TPC/QE 3rd party certificate for Skid Loader,
  not Crane"* — and switching the replacement machine to a Wheel
  Excavator live-updated the message to *"not Wheel Excavator"* without a
  save. Test data removed afterward.
- [x] **F6 — Profile completeness bar.** `src/lib/document-completeness.ts`
  (`computeCompleteness`) plus `CompletenessBadge`/`CompletenessCard`
  (`src/components/documents/CompletenessBar.tsx`). Customer, Equipment
  and Operator detail pages (and a compact version on the list pages) get
  a completion bar: 100% once every document type besides Other has been
  addressed — either a real, applicable document with its file uploaded,
  or a deliberate "not applicable" record. A missing row (never created
  at all) is the only thing that counts against it — this is what makes
  "nobody has looked at this record's paperwork" distinguishable from
  "someone checked and confirmed nothing applies," which used to look
  identical (both rendered as the same neutral grey badge).

  Decided while scoping: expiry does NOT affect the bar — an expired
  document was still addressed, it's just stale now, and the existing
  Valid/Expiring/Expired badges already cover that separately. The FILE
  has to actually be uploaded for an applicable document to count, not
  just the record fields — otherwise the bar can hit 100% with no real
  paperwork attached, which would defeat the point of Phase C.

  For an operator's 3rd Party Certificate item specifically: complete
  only when every machine type they're qualified for (F4's multi-select)
  has a valid certificate covering it, not merely "at least one exists" —
  otherwise an operator qualified for three machines but certified for
  one would incorrectly show as fully covered. Collapses back to a single
  generic item when there are no qualifications to check against, or once
  any 3rd party certificate row is explicitly marked not applicable.

  Verified live: Backhoe Loader + Hammer #1 (2 real documents on file,
  neither with a file attached yet) correctly showed 25%, 1 of 4, with
  Registration/Insurance/Load Test listed as missing despite Registration
  having real dates and a document number — proving the "file required"
  rule actually holds. Giving Rajesh Kumar two machine qualifications
  (Skid Loader, Wheel Loader) correctly expanded the checklist to 10
  items and listed both as separate missing entries; adding one
  certificate with a file for Skid Loader correctly dropped only that one
  from the list. Test data removed afterward.

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
