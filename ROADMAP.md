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

## PHASE D — Timesheets (own build cycle) ✅ Done

Building 2026-08-18. Reviewed against three real timesheets the user
provided (not assumed) — same approach as the invoice work: an L&T Skid
Steer Loader log sheet, an Al-Mohannadi Monthly Equipment Timesheet, and a
Mecon-branded driver timesheet for a McDermott offshore job. Corrected the
spec below against what those actually showed, in two places:

- **Idle/standby hours, dropped.** The original spec (below, kept for
  record) called for Working / Idle / Breakdown as three buckets. None of
  the three real sheets track idle time separately — only Working,
  Breakdown (present on two of three), and free-text Remarks. Building the
  field nobody fills in was the wrong call.
- **Overtime threshold, corrected.** The Mecon-branded sample's own
  "REGULAR (HRS)" column tracks the first 10 hours as regular, with
  overtime only counted past 10 — that's how that document *displays* it,
  not the rule the business actually pays by. Confirmed directly: 0–8h is
  regular rate, 8–10h is 125%, under 8h is paid at actual hours with no
  overtime, and anything past 10h is flagged rather than silently paid
  (statutory OT cap is 2h/day except emergencies — see E3's overtime rules,
  which this reuses).

**The core fact driving this module**: the billable amount is not the
machine rate alone — it's the machine rate applied against operator-
submitted, client-signed timesheets. The signature is what makes a sheet
billable.

**Two separate timesheets, never derived from each other** — confirmed
explicitly, not inferred:
- Equipment timesheet → drives invoicing.
- Operator timesheet → drives payroll.
- Usually the same numbers, sometimes not. Must be separate records, two
  separate Prisma models, two separate calculations. Neither one's hours
  are ever computed from the other's.

**Header** (every timesheet): reference number (auto, sequential),
month/period, customer, project + site, contract ref + LPO number, equipment
(unit name, type, plate/serial), operator (name, ID), company logo.

**Daily rows**, one per calendar day, auto-generated: Date, Start, Finish,
Working hrs, Breakdown hrs, Remarks. `workingHours` is entered directly
rather than computed from Start/Finish — the real sheets don't always
subtract cleanly (overnight shifts, unstated breaks folded into the number),
so the figure people actually sign against is whatever they wrote, not
whatever the clock math says. Start/Finish are reference text, not used in
any calculation.

**Auto-fill defaults** (all editable; the entered value is what's stored and
used downstream — never the default):
- Equipment sheet: 10 hrs/working day, 0 on Friday.
- Operator sheet: 10 hrs/day when assigned to equipment, 0 on Friday. (The
  "8 hrs when not assigned to equipment" case from the original spec
  doesn't apply to this build — see scope note below.)
- Vacation days show as 0, marked distinctly as vacation — not absence, not
  unworked. **Resolved by Phase E2** (2026-08-21): `OperatorTimesheetDay`
  gained `dayType`/`leaveType`, defaulted from approved leave at generation
  time. See Phase E2 below.

**Footer**: total working/breakdown/regular/overtime hours as applicable.
Signature blocks: operator, client site representative, company
representative. Date signed.

**Scope drawn for this build**: both timesheet types link to a specific
`EquipmentAssignment` / `OperatorAssignment` — same reasoning the
assignment models already use for `deliveryNoteNumber` (a replacement
machine needs its own delivery note; a replacement operator needs their own
timesheet history). This matches all three real examples, which are every
one of them tied to one contract and one machine/operator pairing. It does
**not** cover general workforce attendance for employees who aren't
currently on a contract (admin, mechanics, an operator between jobs) — that
's a broader E-phase concern for whenever full-workforce payroll is built,
not what these three documents are.

**Downstream rules — these produce two different numbers**:
- Invoicing reads the *equipment* timesheet, applies the contractual
  10hr/day minimum. Site worked 8 → invoice still reads 10.
- Payroll reads the *operator* timesheet at actual hours, split by the
  overtime rule above. Worked 8 → paid 8, all regular. No automatic
  overtime beyond what the rule computes. Payroll never inherits the
  billed figure.
- Regular/overtime split is **computed, not stored** — same "one source of
  truth" pattern as `getDocumentStatus` and profile completeness elsewhere
  in this app. `workingHours` is the only number actually saved per day;
  the split is derived from it every time it's read, so it can never drift
  out of step with an edited hour figure.
- `src/lib/hours.ts`'s `hoursFor()` (currently an ESTIMATE) is meant to
  start reading real equipment timesheet data once this exists — that
  swap, and the equivalent for payroll, is **not** part of this build.
  Timesheets and their own PDF/export come first; wiring billing.ts and a
  future payroll engine to actually consume them is a follow-up step once
  this is verified working. Building that wiring now would mean guessing
  at Phase E3's shape before it exists.

**Output**: export to PDF for client signature (browser print page, same
pattern as the invoice print page — no PDF library), export to spreadsheet
(plain CSV, Excel opens it natively — same "use what the platform gives
you" reasoning), mark Signed/Approved before it can be invoiced against.

**Shipped**: 4 models (`EquipmentTimesheet`/`Day`,
`OperatorTimesheet`/`Day`), reference numbering (`ET-0001`, `OT-0001`,
separately sequenced), a cascading contract → assignment → month picker for
creating either type, one bulk-editable daily-rows table shared by both
(`showOvertimeSplit` is the only thing that differs), sign/unsign with the
table locking while signed, print pages, and CSV export. Nav link added.

Verified against real data on the Lusail Boulevard contract, not synthetic
rows: created an equipment timesheet for Boom Truck 6x4 #2, confirmed day
generation correctly clamped to the assignment's actual start date (08 Aug,
not the 1st) and defaulted 10hrs/0 on Friday (21 working days × 10 = 210).
Edited an hour figure and a remark, saved, reloaded, confirmed persistence.
Signed it, confirmed the table actually disables rather than just hiding
the save button; unsigned, confirmed it re-enables. Created an operator
timesheet for Rajesh Kumar and hand-verified the overtime split against
three deliberately different day types — 9h (8 regular + 1 OT), 13h (8
regular + 2 OT, correctly capped, and the one day that triggered the
"over 10h" flag banner), 6h (6 regular + 0 OT, no overtime under 8h) — the
totals row summed correctly across all 30 days. Print and CSV export
checked for both types. Test data deleted afterward.

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
additive column plus a Prisma-model rename, not a data migration.

**UI caught up 2026-08-20**, once the real 50-person roster gave the other
five categories actual data to look at. The general list/form now covers
all six categories — nav renamed "Operators" → "Employees" (routes and
component/file names deliberately kept as `operators/*` underneath — same
tolerated name-vs-reality gap the database already has via `@@map`;
renaming every file for a cosmetic gain risked breaking the working
Operator-specific code that Timesheets and Contracts depend on). Category
is now a real, user-set field on the form (was hardcoded to Operator on
create). "Machines qualified to operate" only shows for Operator category.
Contract assignment's operator picker (`loadOperatorOptions` in
contract-options.ts) is unchanged and still filters to Operator only —
confirmed unaffected, not just assumed: searched a freshly-created
Admin/Office test employee in the contract form's operator field and
confirmed "No matches".

**Bug found and fixed in the same pass**: profile completeness was
checking every employee against the full Operator document checklist —
every category shares `ownerType: 'OPERATOR'` on Document (that's the FK
discriminator, not the person's actual job), so a Welder would have
needed an "Operator License" to ever reach 100%. `computeCompleteness`
gained an optional checklist override
(`EMPLOYEE_CATEGORY_DOCUMENT_TYPES[employee.category]` in enums.ts); the
document type PICKER stays the full unified list for everyone,
deliberately — only what counts toward 100% narrows, so an unusual real
need can still be recorded even if it won't move the needle.

Every read that filters on `category: 'OPERATOR'` explicitly (the
contract picker, payroll's whole-workforce generation) is unaffected by
any of this — see each phase's own notes.

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

### E1 — Employee documents and certifications ✅ Done

Built 2026-08-18. Reuses the existing document-with-expiry pattern and
alerting (same as customer/equipment) — turned out to be a small change,
because almost every type below already existed from earlier phases. The
only two genuinely missing were `Visa/Residence Permit` and `Employment
Contract`, added to `OPERATOR_DOCUMENT_TYPES` in `src/lib/enums.ts`. 3rd
Party Certificate — Assessment/TPC/QE was never two separate document
*types* — it's one type (`3rd Party Certificate`) with a `thirdPartyType`
sub-field, already built in Phase B1.

*Legal and identity — compliance-critical, an expiry here can stop a man
working*: Qatar ID (QID), Passport, Visa/Residence Permit, Employment
Contract, Medical Certificate/Health Card.
*Competency and site access*: Driving License, Operator License, 3rd Party
Certificate — Assessment, 3rd Party Certificate — TPC/QE, H2S Certificate,
Defensive Driving Certificate, Gate Pass (project-specific), Other.

Rules: Assessment and TPC/QE are separate records (one, both, or neither).
H2S and Defensive Driving separate, never combined. **QID and Visa expiry
escalate harder than other documents** — an expired QID is a legal exposure,
not an administrative one. Built as a wider "expiring soon" window — 60
days instead of the standard 30 — for just those two types
(`EXTENDED_ESCALATION_TYPES` in `src/lib/document-status.ts`); everything
else keeps the 30-day window. This was a judgment call, not a spec — the
roadmap said "escalate harder" without saying how; flagged to the user, no
objection.

Verified live: added a Visa/Residence Permit document expiring 45 days out
— correctly showed "Expiring soon" (45 ≤ 60), which would have shown
"Valid" under the old 30-day rule that still applies to every other type.
Confirmed the new types appear in the Add Document dropdown, and that
profile completeness on an operator with 3 documents on file correctly
recalculated from "0 of 9" to "0 of 11" with both new types listed under
"still missing." Fixed a copy bug this surfaced: the operator detail
page's summary banner hardcoded "expiring within 30 days," which is no
longer always true — changed to "expiring soon." Customer and equipment
pages keep the literal 30-day wording since the extended window never
applies to them. Test document removed afterward.

**Real staff list imported, 2026-08-20.** The user supplied the actual 50-
person roster ("Employe List.xlsx" — staff number, name, job title).
Added `Employee.jobTitle` (free text — the literal title, e.g. "WELDER",
"CAMP BOSS"; `category` stays the coarse bucket the app's logic branches
on, several distinct titles share one category) via
`scripts/import-employees.ts`, a one-off, re-runnable, not a standing
feature. `employeeNumber` and `jobTitle` are now shown and editable
wherever an operator already is — form, detail page, list page (list is
now also searchable by staff number and job title).

None of the 50 real names matched the pre-existing demo employees
(Mohammed Ashraf, Rajesh Kumar, Sunil Prasad — all tied to real contract/
invoice/timesheet history built up over this session) — left completely
untouched. 27 of the 50 are Operator category and now visible in
`/operators`; the other 23 (drivers, mechanics/workshop, admin/office,
management) are correctly categorized in the database but have no UI to
appear in yet — that's the broader HR staff-list work this roadmap has
always scoped as later, not part of E1.

Category mapping involved a few judgment calls on ambiguous titles (CAMP
BOSS → Management, WS OFFICE BOY → Mechanic/Workshop) — see the script's
header comment for the full list; flag any that read wrong.

### E2 — Leave management ✅ Done (encashment deferred — see below)

Built 2026-08-21. Touches three systems, per the original scope: leave
itself, timesheets (day-type), and payroll (shortfall calculation).

**Gap found while scoping, fixed as part of this phase**: nothing recorded
when an employee joined. Annual leave eligibility ("after 1 full year"),
the 3-week/4-week service tier, and E4's future gratuity calc all
fundamentally need it. Added `Employee.dateOfJoining` — schema field only,
no real data yet (the imported 50-person roster never had it), fills in as
the business supplies it, same pattern `employeeNumber` followed in an
earlier phase. `Employee.dateOfExit` added alongside it, as asked — also
schema-only for now. **Encashment itself (paying out unused annual leave on
exit) is still not built** — it needs a real settlement calculation this
phase didn't scope; `dateOfExit` existing is only the precondition, not the
feature.

**Four judgment calls the business hasn't confirmed yet** — asked directly,
answer was "need to check with the business" for all four, so each was
built to the safer/statutory-literal default and isolated in one place so
correcting it later is a small change, not a rework. Added to Open
Questions below:
- Leave days consumed = calendar days including Friday (not working-days-
  only) — `leaveDaysConsumed` in `src/lib/leave.ts`.
- Sick leave's 3 pay tiers (2wk full / 4wk half / remainder unpaid) tracked
  cumulatively across the current SERVICE YEAR, not reset per illness spell
  — `sickLeavePayTiers`.
- Emergency leave defaults to unpaid (not in the statutory articles at all,
  a company benefit) — overridable per request via `paidOverride`.
- Hajj leave has no religion field to gate it — the type is just available
  to record for anyone; office manages actual eligibility/priority
  manually. This one's a design call, not really an open question — no
  sensitive personal-data field for one narrow rule.

**Other decisions made while building, consistent with the codebase's
existing conventions**:
- **Balance is computed, not stored** — same "status is always derived"
  principle as document status, contract status and the overtime split
  (NOTES.md). `computeAnnualLeaveBalance` in `src/lib/leave.ts` walks every
  completed service year from the join-date anniversary, carrying forward
  up to half of each year's unused entitlement (Art. 79), then prorates the
  current still-open year by elapsed fraction. No accrual before the
  1-year eligibility mark.
- **Leave year = 12-month cycle from the join-date anniversary**, not the
  calendar year — makes "eligible after 1 year" and the 5-year tier bump
  mean something per-employee.
- **"Approval" is a status field only** — confirmed scope, no real
  approval trail, since there's no user-account system yet. `decidedBy` is
  free text for whoever is at the keyboard.
- A public holiday inside an approved ANNUAL request doesn't consume a
  balance day (Art. 79's "leave extends by that day"), implemented as an
  exclusion from the day count rather than literally pushing the end date.

**Timesheet wiring**: `OperatorTimesheetDay` gained `dayType`
(WORKING/LEAVE/PUBLIC_HOLIDAY) and `leaveType`, defaulted from that
operator's APPROVED leave requests and declared public holidays when a
timesheet is generated (`resolveOperatorDayTypes` in
`src/lib/actions/timesheets.ts`), editable afterward the same way hours
are. `DailyRowsTable` shows a Day type column (operator sheets only —
equipment timesheets never call this, a machine doesn't take leave).
Equipment timesheets untouched — out of scope, see the phase's original
scoping note.

**Payroll wiring**: `computePayslip` (`src/lib/payroll.ts`) now takes
`paidLeaveHours`/`unpaidLeaveHours`. Explained hours = worked + paid leave +
unpaid leave; only the unexplained remainder AND unpaid leave get deducted
— paid leave no longer reads as a shortfall. This applies to **every**
employee, not just operators with signed timesheets — an ESTIMATE-sourced
employee's assumed-full-attendance hours are now reduced by their known
leave too (`leaveHoursForEmployeePeriod` in `src/lib/actions/payroll.ts`),
otherwise unpaid leave would have zero payroll effect for the ~23
non-operator staff who never get a signed timesheet. `Payslip` gained
`paidLeaveHours`/`unpaidLeaveHours` columns, shown and editable on the
payslip screen and the print page.

**Shipped**: `LeaveRequest`/`PublicHoliday` models, `src/lib/leave.ts`
(entitlement/accrual/balance/day-counting/sick-tier — all pure functions),
`src/lib/employee-status.ts` (derived Active/On leave/Exited), request/
approve/reject/cancel actions, a leave list, request form, detail page
with approve/reject, a month calendar (filterable by category and by the
employee's current contract site, pulled from their active
`OperatorAssignment`), a public holidays settings page (mirrors
`RamadanPeriod`'s pattern), and a Leave section on the employee detail page
showing the live balance and request history. Nav link added.

Verified against real data, not synthetic: gave Rajesh Kumar a join date
2 years 3 months back (2024-05-10) and hand-verified the balance before
trusting the screen — entitlement 5.98 days (21 × prorated elapsed
fraction of his 2nd eligible service year), 10.5 carried in (half of a
fully-unused first eligible year), 0 taken, 13.48 after balance = 16.48.
The app produced exactly that. Requested and approved 3 days of Annual
leave (24–26 Aug 2026); balance correctly dropped to 13.48. Generated an
August 2026 operator timesheet on his real Lusail Boulevard assignment —
the 3 leave days correctly showed `Leave / Annual leave` with 0 hours
instead of a blank gap; every other day defaulted Working as before.
Signed it and ran payroll: hand-verified the full chain before trusting
the screen — 23 working days × 10hrs = 230 total (184 regular + 46 OT,
matching the existing 8/10hr split), 24hrs of paid leave correctly
excluded from the shortfall, but the pre-existing 1-day gap (his
assignment starts Aug 2, a real gap from before E2 ever existed) still
correctly deducted 8hrs unpaid — shortfall QAR 100, overtime QAR 718.75,
basic pay QAR 3,618.75, gross/net QAR 4,418.75. The app matched exactly.
Separately hand-verified `sickLeavePayTiers`/`resolveLeaveDaysInRange`
against three cases via script: 20 days from scratch → 14 full + 6 half;
10 more days after 10 already used → 4 full + 6 half (continues the
cumulative count correctly); 50 days from scratch → 14 full + 28 half + 8
unpaid, exactly matching Art. 82's 2-week/4-week/remainder split. Test
data (leave request, timesheet, payroll period, and the fabricated join
date/salary) removed afterward.

**Statutory entitlements** (spec, for reference):
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

**Features, all shipped except encashment**: leave types (Annual, Sick
[tiered pay], Unpaid, Hajj, Maternity, Emergency, Public Holiday);
entitlement per employee, defaulting to statutory by service length,
overridable where the company pays more; accrual and running balance;
carry-over up to half of annual leave into the following year; request/
approval flow; leave calendar (filterable by category and site). **Leave
encashment — unused annual leave paid out on exit — not built this
phase.** `dateOfExit` now exists (added this phase) so it's no longer
blocked, but the settlement calculation itself is new scope, likely
alongside E4 (gratuity), since both compute a final-settlement figure.

**Downstream effects, shipped**: feeds timesheet auto-fill (a leave day
shows as leave, not absence/unworked — see Timesheet wiring above).
**Unpaid leave vs. paid annual leave for gratuity's continuous-service
calculation** — still relevant for E4, not resolved by this phase; E4
will need to read `LeaveRequest.leaveType` when it's built.

### E3 — Payroll ✅ Done (WPS export deferred — see below)

Building 2026-08-18, right after Phase D (timesheets) landed, so payroll has
real hours to read from.

**Scope decisions made before building**:
- **WPS/SIF export deferred**, confirmed with the user — the format is
  bank-specific and building it blind risks the bank rejecting the file.
  Everything else (salary structure, minimum wage validation, overtime,
  payslips, payroll register) is built and fully testable without it.
- **Hourly/daily rate = basic ÷ 30 ÷ 8** — the same 30-day divisor E4's
  gratuity formula already uses below, kept consistent rather than
  introducing a second convention.
- **Whole-workforce coverage, not just contract operators** — the entire
  reason Employee was unified into one table (E0) was that mechanics,
  admin and drivers need payroll despite never appearing on a contract. An
  operator with a **signed** OperatorTimesheet for the period reads real
  hours from it; every other employee gets an editable estimate (standard
  hours for the month) — the same "estimate now, precise later, always
  labelled which" pattern `hoursFor()` and the timesheets themselves
  already use.
- **Ramadan is a plain date-range setting**, entered by staff, not
  hardcoded — moon-sighting dates aren't something to guess at.
- **Deductions are a flat amount + note per payslip**, not a full loan/
  advance ledger with balances and repayment schedules — nobody's asked
  for that yet.
- **Leave pay and gratuity are out of scope** — both need Phase E2/E4.
  **Leave pay resolved by Phase E2** (2026-08-21): `computePayslip` now
  takes `paidLeaveHours`/`unpaidLeaveHours` and only unpaid leave (plus any
  genuinely unexplained gap) is deducted — see Phase E2 below. Gratuity
  (E4) is still out of scope.

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
- **Deferred** — not part of this build. Everything above it in this
  section shipped.

**Shipped**: Employee salary/bank fields (schema), minimum-wage validation
with a live warning on the employee form, `RamadanPeriod` settings UI,
`src/lib/payroll.ts` (the calculation engine — `computePayslip`,
`standardHoursForMonth`, `checkMinimumWage`), a payroll period create flow
that generates one payslip per employee with a basic salary set (skipping,
never zero-filling, everyone else), a payslip edit view with a live
breakdown (basic → shortfall → overtime → allowances → gross → deductions
→ net, computed client-side with the exact same function the server uses
to persist), finalize/unfinalize locking, print page, and a payroll
register CSV export. `/payroll/[id]` shows how many payslips are on an
estimate vs. real timesheet data.

Verified against real data, not synthetic: gave Rajesh Kumar a real salary
(QAR 3,000 basic + allowances) and a signed August 2026 operator timesheet
(30 days, unedited defaults — confirmed 260 total hours by hand first).
Generated an August payroll period and hand-verified every figure on the
resulting payslip against the formula before trusting the screen: standard
month = 216 hrs (27 working days × 8, no Ramadan period covering August),
actual regular/OT from the signed timesheet = 208/52 (26 days × 8, 26 × 2 —
the assignment starts Aug 2, one working day short of the full month),
shortfall = 8 hrs × QAR 12.5/hr = QAR 100, overtime = 52 hrs × QAR 12.5 ×
125% = QAR 812.50, basic pay = 3,000 − 100 + 812.50 = QAR 3,712.50, gross
with allowances = QAR 4,862.50. The app produced exactly that number.
Confirmed every OTHER employee (no basic salary set) was correctly skipped,
not zero-filled — only 1 payslip generated. Added a QAR 200 deduction,
confirmed the live breakdown and the saved database row matched exactly.
Finalized the period, confirmed the payslip's hour/deduction inputs
actually disabled (not just the save button hidden). Checked the print
page and CSV register export. Test data removed afterward.

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

### Future — Override authority (not started)

Raised by the user 2026-08-28, no build yet — captured here so it isn't
lost, not scoped into a concrete plan.

The 3-role system built in Phase F (Admin/Operations/Viewer) is not
fine-grained enough for where this is headed. The user wants specific
business-rule overrides restricted to the General Manager specifically —
not "any Admin." Concrete example given: under the duration rule, a
rental under 30 days should be charged a mobilization charge; today
mob/de-mob charges don't block invoice generation at all (no enforcement
exists yet — flagged elsewhere as a real, separate gap). Once that
enforcement exists, only the GM should be able to override it (e.g.
waive a mob charge that would otherwise apply).

**Current state**: Muhideen (Logistics,
`logistics@meconqatar.com`) and the GM (`info@meconqatar.com`, Ataya Abu
Samhadaneh) were both given the ADMIN role when their accounts were
created — explicitly described by the user as "right now they are both
the same," a deliberate, temporary equivalence, not an oversight.
Muhideen's authority is meant to narrow later; the GM's is meant to stay
at the top.

**Not yet decided**: how to model this — a fourth role, a per-user
override flag on top of ADMIN, or a business-rule-approval table are all
plausible directions. Depends on how many other "only the GM can
override X" rules turn up once mob/de-mob enforcement itself gets built
— ask the user rather than guessing when this is picked up.

### Phase F — Access control and per-bank WPS export

Raised by the user mid-session 2026-08-21, outside the original 5-phase plan
— two separate change requests. Built 2026-08-21/22.

**Checked first, as explicitly asked, before building anything**: this app
had NO role or account system at all going in — the only access control
was `src/proxy.ts`'s shared HTTP Basic-auth password (no accounts, no
roles, no audit trail, by its own doc comment). Every "override" elsewhere
in the codebase (mobilization charge, document checklist, leave pay) is a
business-rule override, never an access-control one — there was no
existing "override authority" logic to extend. This was a full new system,
not an extension.

**Login mechanism — confirmed with the user before building**: email +
password per person (not a shared password with roles bolted on — that
would make the audit trail worthless, since anyone with the password could
claim to be anyone). The old shared-password gate is fully replaced, not
layered underneath.

**Shipped**:
- `User` (email/password/role), `Session` (opaque token, DB-backed — not a
  JWT, trivially revocable), `AuditLog` models. Password hashing via
  Node's built-in `scrypt` — no new dependency, same reasoning `src/proxy.ts`
  already used for its own timing-safe compare.
- `src/proxy.ts` rewritten: checks for a valid session, redirects to
  `/login` otherwise. Runs in the Node.js runtime (Next 16's new default
  for Proxy — confirmed in `node_modules/next/dist/docs` before writing
  this, since AGENTS.md flags this app as having Next-version-specific
  breaking changes), so a real Prisma session lookup here is safe; no Edge
  workaround needed.
- `src/lib/permissions.ts` (pure role → capability checks) and
  `src/lib/auth/guard.ts` (the same checks backed by a real session
  lookup, for Server Actions and pages). **Every mutating Server Action in
  the app** — all 11 `src/lib/actions/*.ts` files, ~40 functions — now
  calls `requireWrite()`/`requireDelete()`/`requirePayrollAccess()` before
  touching the database, and logs an `AuditLog` row after. This is the
  real enforcement boundary: a request that bypasses the UI entirely still
  can't do anything a role shouldn't. Next's own guidance is explicit that
  Proxy alone isn't sufficient — every Server Function must check for
  itself — so that's what these do.
- **Payroll/salary locked to Admin**: all 6 `/payroll/*` pages and the
  register-export route check `requirePayrollPage()`/an inline
  `canViewPayroll` check; the employee form's salary/bank fieldset is
  server-stripped from the page payload for anyone who can't see it (not
  just hidden in the client — the numbers never reach a non-Admin's
  browser at all).
- User management (`/admin/users`, Admin only): create, edit, delete,
  reset a password (no email infrastructure exists for a "forgot
  password" flow, so an Admin resets directly). Blocks an Admin from
  demoting themselves out of the only Admin account, and from deleting
  their own account while signed in as it.
- Audit log viewer (`/admin/audit`, Admin only): latest 200 entries, who/
  when/action/record.
- `scripts/create-user.ts` — one-off bootstrap script (the database starts
  with zero users), also reusable for a manual password reset. First
  Admin account created for the user directly in this session.

**Known gap — UI button-hiding is only partially rolled out.** The spec
was explicit that "the UI must hide actions a role cannot perform, not
just fail on submit," and that's done for the nav bar (Payroll/Users/
Audit log links), `DocumentsSection` (shared across Customers/Equipment/
Operators — Add/Edit/Delete all gated), and the Customers detail page's
Edit button. It is **not yet done** on Equipment, Operators (beyond the
payroll fieldset), Contracts, Invoices, LPOs, Timesheets, or Leave — those
pages' Edit/Delete buttons still render for every role today. This is a
UX gap, not a security one: the server-side guards above block the
action regardless of what the UI shows, confirmed by the fact every
action file was swept, not just some. Flagged rather than silently left
implied by an unqualified "done."

**WPS export, per bank**: bank became a field on the employee record
(`Employee.bankName`, constrained to `BANKS` in `src/lib/enums.ts` — a
closed list now, since it decides which SIF file a payslip lands in,
unlike most of this app's free-text fields). `src/lib/wps.ts` holds each
bank's field layout as its own config, per the user's explicit
instruction not to guess.

- **CBQ — done.** Built directly from a real sample SIF file the business
  supplied (`SIF_12943300_CBQ_20260818_1353.csv`) — a two-block CSV: an
  employer/payer header row, then one row per employee. Not the QCB fixed-
  width spec; this is what CBQ's own system expects from this employer
  specifically. The sample contained real employee QIDs, bank accounts and
  salaries — treated as sensitive per the user's instruction, never
  reproduced in this doc or anywhere else; only the company's own payer
  details (Employer QID, Payer IBAN) were kept, the same way `COMPANY`'s
  own invoice letterhead details already are.
- **QNB — layout built 2026-09-26, see Phase F2 below.** Was blocked on a
  sample file; a real QNB SIF file turned out to be available, so the
  layout is no longer a guess. What remains is a data-entry job, not a
  build job: the company's own QNB establishment number and account IBAN.
  The export page now says so explicitly instead of "Field layout not yet
  configured".
- **Pre-submission validation, built**: blocks export per bank with a
  named list of what's missing — no bank assigned, no IBAN, or no valid
  (non-expired) Qatar ID/Visa-Residence-Permit document — rather than
  producing a file the bank would reject. QID/Visa validity reuses the
  existing document-expiry system (`getDocumentStatus`) rather than a new
  field, so it can never disagree with what the Documents tab already
  shows.

Verified against real data, not synthetic: gave Rajesh Kumar a basic
salary, CBQ as his bank, and a real IBAN; generated an August 2026 payroll
period and downloaded the CBQ SIF. The output matched the sample's
structure field-for-field, including the "Total Records" zero-padding and
the "Number of Working days" convention (calendar days in the month, not
business working days). His Qatar ID number was pulled correctly from his
existing Document record. Basic + Extra income − Deductions reconciled
exactly to Net Salary (3000 + 800 − 0 = 3800) — deliberately exact, unlike
the sample file's own arithmetic, which didn't always reconcile cleanly on
a couple of its rows. Separately hand-verified the blocking validation
against three synthetic cases (no bank, expired QID, clean record) — each
flagged or passed exactly as expected. Test data removed afterward.

Full user/role verification (Admin confirmed working end-to-end; a
Viewer/Operations account was created and its `canWrite`/`canDelete`/
`canViewPayroll` matrix hand-verified against the spec, then removed) —
not yet re-verified live in the browser under an actual Operations or
Viewer login post-sweep, since the sweep landed after that check. Worth a
quick pass before this is called fully done.

### Phase G — App shell, audit log rebuild, and record history ✅ Done

Raised by the user 2026-08-22, outside the original 5-phase plan and
outside Phase F — a detailed spec covering three parts: a real sidebar
shell (replacing the old top nav), a full rebuild of the Phase F audit
log viewer (filters, cursor pagination, CSV export, expandable diffs),
and a per-record "Change history" panel on every detail page. Delivered
with a clickable HTML prototype for structure/density/copy reference —
interpreted as "match structure, not literal markup," so this app's own
Tailwind/slate conventions were kept rather than the prototype's separate
CSS custom-property system.

**Decided before building, per the user's own "what's your advice"
question**: whether to build detailed field-level diff tracking
(`changedFields`) now, retrofitting all ~40 existing audit call sites, or
defer it until the audit log actually needed to answer "what changed,"
not just "that something changed." Recommended building it now — the
retrofit only gets more expensive as more call sites accumulate, and this
session already had full context on every one of them. User agreed.

**Data model**: `AuditLog.changedFields Json?` — an array of
`{ field, was, now }`, each value **already formatted as a display
string at write time** (via `formatQar`/`formatDate`/etc.), never the raw
database value reformatted later. Deliberate: a stored diff must never
reword itself retroactively if formatting logic changes — an audit trail
that can rewrite its own history defeats the point of having one.
`CREATE` uses `was: null`; `DELETE` uses `now: null` (the same shape as
`CREATE`, not a third shape); `UPDATE` uses both. Values are truncated to
200 characters, and secrets/blobs are never stored — `documents.ts` logs
`fileName`, never `fileUrl`; `users.ts` logs a `Password: Reset` marker,
never the password itself. `src/lib/audit.ts` —
`diffField`/`createdField`/`deletedField` (alias of `createdField`)/`fmt`
helpers, `logAudit()`.

**Retrofit**: all 11 `src/lib/actions/*.ts` files (~40 functions) now
pass a `changedFields` array into every `logAudit()` call — meaningful
fields only, not every column (a timesheet day-row edit logs "Total
working hours: 240 → 236", not 30 individual day diffs, per the spec's
own instruction). Pre-existing audit rows written before this migration
have no `changedFields` and correctly fall back to "No field detail
recorded for this entry" (`DiffTable`'s `asFieldChanges` type guard)
rather than crashing — confirmed live against a real pre-retrofit
UPDATE row (Rajesh Kumar, Employee).

**Shipped**:
- **App shell** — `src/components/shell/Sidebar.tsx` (client component,
  grouped nav: Operations / People + Payroll (admin-only) / Yard / Admin,
  cheap live counts via 3 parallel COUNT queries loaded once in
  `layout.tsx`, mobile hamburger + slide-over), `PageHeader.tsx`
  (breadcrumb + title + actions slot), `icons.tsx` (12 hand-drawn stroke
  icons — no new dependency). Replaces the old top nav in
  `src/app/layout.tsx`.
- **Audit log rebuild** (`/admin/audit`) — URL-synced filters (search,
  action, date range incl. custom, user, record type —
  `src/lib/audit-queries.ts`'s `parseAuditFilters`/`buildWhere`), cursor-
  based "Load more" (`loadMoreAuditEntriesQuery`, a real Prisma `cursor`/
  `skip: 1` seek, not `OFFSET` — stays fast regardless of log size), CSV
  export of the current filtered set (`/admin/audit/export`), expandable
  rows showing the field-level diff (`DiffTable`, shared with the record-
  history panels below so the two views can never drift apart).
- **Record history panels** — `RecordHistoryPanel`
  (`src/components/audit/RecordHistoryPanel.tsx`) added to all 10 record
  detail pages that have one (Contract, Customer, Equipment, Employee,
  LPO, Invoice, Leave request, Payroll period, Equipment timesheet,
  Operator timesheet) via `loadRecordHistory(entityType, entityId)`.
  Shows "No changes recorded for this record yet." when empty — verified
  live on a machine with no audit history.
- **Deleted-record handling** — every one of those 10 pages' `notFound()`
  now checks `findDeletionRecord(entityType, entityId)` first; if the id
  was real but the record was deleted, shows "This record was deleted.
  Its last known values are still in the audit log." (`DeletedRecordNotice`)
  with a link back to the audit log, instead of a bare 404.
- `src/lib/audit-model.ts` — `humanizeModelName`/`recordHref`/
  `AUDIT_ACTION_LABELS`, shared by both the audit list and every history
  panel so a model name or record link can never read differently in two
  places.

**Verified live in the browser**: created a real customer ("UI Diff Test
Co"), confirmed its CREATE diff rendered correctly in both the audit log
row and its own detail page's history panel, confirmed the record-name
link resolved to the real detail-page URL, confirmed filtering by search
text correctly narrowed the visible row list (see bug below), confirmed
the zero-history and pre-retrofit-no-detail states both render their
correct fallback text, and (after the Neon branch fix below) confirmed
the deleted-record path itself — created and deleted a second test
customer for this specifically, since it's a genuinely new code path (an
early return before the rest of the page renders) not exercised by
anything else in the codebase yet; `DeletedRecordNotice` rendered
correctly with the record's last-known name. Both test customers and
their audit rows removed afterward via one-off scripts, not left in the
database.

**Real bug found and fixed during verification**: `AuditEntryList`
(Client Component) held its row list in `useState(initialEntries)`,
initialized once — a server re-render passing new filtered
`initialEntries` props does not reset already-mounted local state, a
classic React stale-derived-state pitfall. Typing a search term
correctly updated the URL and the server-computed "Showing N of M" count,
but the visible row list stayed unchanged. Fixed with
`key={JSON.stringify(filters)}` on `<AuditEntryList>` in `page.tsx`,
forcing a full remount (and therefore a fresh `useState`) on every filter
change — correct anyway, since any accumulated "Load more" state should
be discarded on a new filter.

**Breadcrumb rollout — closed 2026-08-23.** `PageHeader` now covers every
list page (10), every record detail page (10), and the 4 specialized
pages that had their own back-link+title pattern (leave calendar, public
holidays, Ramadan periods, payslip detail) — 24 pages total, converted in
one pass and spot-checked live across roughly a third of them. Two
extensions were needed to fit every existing page's markup:
`PageHeader` gained an optional `badge` slot (a status pill inline with
the title — contract status, invoice state, document completeness, etc.)
and `description` widened from `string` to `ReactNode` (a few pages put
a link inside their description, e.g. a contract's customer name).
Excluded on purpose: the 4 print pages (letterhead layout, must never
show app chrome), `new`/`edit` forms (different UX — Save/Cancel live in
the form itself, not a header actions slot), and `login`/the root
redirect (no session, no shell).

**Real bug found and fixed during the spot-check, unrelated to the
rollout itself**: `DailyRowsTable` (every timesheet detail page) put a
hidden `<input>` directly under a `<tr>`, invalid HTML that was silently
breaking hydration on every load — caught via the browser's own console,
not visually. Moved inside the row's first `<td>`; confirmed against the
live DOM afterward, since the console panel intermittently held a stale
error from before the fix and had to be double-checked directly.

Committed to `feat/shell-audit-ux` (`f3815bf`) and pushed to GitHub —
Vercel built a Preview deployment from it automatically.

**Neon branch isolation — caught late, then fixed.** The original
instruction was to create a matching Neon database branch before
starting so this work wouldn't touch shared data; no Neon CLI/API
credentials were available at the time, so that step was silently
skipped and all of Stage 1-5's migrations and test writes (see below)
actually ran against the `production` branch of the `Mecon-dev` Neon
project — the same database other local dev already uses (not the
deployed site's own database — `.env`'s own warning comment already
distinguished the two — but still not the isolated branch that was
promised). Caught while writing this ROADMAP entry, before the false
claim shipped; flagged to the user directly rather than left implicit.
Fixed same session: user supplied a `NEON_API_KEY` via `.env` (gitignored,
key never appears in chat), used to create a real branch —
`feat/shell-audit-ux` (`br-lucky-union-ax6wlmfd`), forked off
`production` — via `neonctl branches create`. `.env`'s `DATABASE_URL` now
points at that branch's own connection string (the shared-branch URL is
kept commented alongside it for an easy revert). `npx prisma migrate
status` confirmed the new branch already carries all 15 migrations
(inherited at fork time, including this phase's own
`audit_field_diffs`), and the app was reloaded against it and re-verified
live. Net effect: the migration and the now-deleted test customer did
touch the shared dev database before this fix landed, but nothing
destructive happened and no further work will.

**Two Neon projects existed, and the wrong one was assumed to be
"production."** Verifying the Preview deployment surfaced a second,
bigger mix-up: this Neon *account* has two projects, `Mecon-dev` (used
throughout this phase, above) and a separately-named one holding the
*actual* data Vercel's Production and Preview environments both read
from — confirmed by querying it directly and finding real customer
records. That real database had zero user accounts, which is the actual
reason the Preview login failed ("wrong password") — not a password
issue, there was no account to log into. Resolved by getting a
`VERCEL_TOKEN` from the user, using it to confirm the Preview env var's
scope, then creating the first Admin account directly in the real
database via `scripts/create-user.ts`. Also confirms Vercel's Preview
build already ran `prisma migrate deploy` against that real database
when the branch was pushed — additive-only so far (this phase's own
migrations), but worth remembering next time a schema change here is
more than additive. Full account, including how it was diagnosed, in
NOTES.md's "Two Neon projects exist, and their names don't tell you
which is real."

**Table-alignment polish, found live on the Preview deployment.** Three
pre-existing list pages (Equipment, Customers, Employees — none touched
by this phase's own build) vertically-center each `<td>` independently,
so a row with a wrapped machine name/model sits at a different height
than its neighbors, and the "N expired"/"N expiring" label next to the
document-status badge could itself wrap onto two lines. Fixed by aligning
every cell to the row's top edge (`[&_td]:align-top` on each `<table>`)
and stopping that short status label from wrapping
(`whitespace-nowrap`) — `src/app/equipment/page.tsx`,
`src/app/customers/page.tsx`, `src/app/operators/page.tsx`.

**Full-app QA pass, 2026-08-27/28** — before handing this to the
business, went through every major flow as a user rather than just
reading the code: customer create/edit, a full leave request → approve
→ cancel cycle, timesheet sign/unsign, a complete contract creation
(customer/equipment/operator pickers, warnings, mobilization charge),
document records, invoice generation, payroll period creation +
finalization, and the CBQ WPS export. Everything passed. Two things
worth recording:

- **Found and fixed a real bug**: `DailyRowsTable` (every timesheet
  detail page) had a hidden `<input>` directly under a `<tr>` — invalid
  HTML, silently breaking React hydration on every load. Not visible to
  the eye; caught via the browser console, then fixed and confirmed
  against the live DOM (the console panel itself intermittently held a
  stale pre-fix error, so it wasn't trustworthy alone).
- **False alarm, worth recording anyway**: a generated invoice showed
  line items for "Crane" and "Wheel Excavator" on a contract whose
  current machine is named "Boom Truck 6x4 #2" — looked like it billed
  the wrong equipment. Traced it: invoice lines print by equipment
  *type* + capacity (the business's own convention), and that machine's
  `type` field is literally "Crane." The billing engine had also
  correctly split the invoice across a mid-month breakdown replacement,
  computing each machine's hours separately. Genuinely correct, not a
  bug — but exactly the kind of thing that has to be traced to the
  bottom rather than either trusted or flagged on a hunch.

One real gap in this pass: file upload itself (the literal bytes →
Vercel Blob path) can't be driven through browser-automation tooling —
no way to operate the OS's native file-picker dialog. Everything around
it (the document record, the completeness rule requiring a real file)
was verified; the upload mechanic itself wasn't.

**Design polish — two items closed, 2026-08-28.** Of the four
improvements flagged after reviewing the new shell: replaced every
native `confirm()` dialog (unsigning a timesheet, unfinalizing payroll,
deleting a document) with a shared `useConfirmDialog()` hook
(`src/components/ui/ConfirmDialog.tsx`) styled to match the rest of the
app — same await-the-answer control flow as `window.confirm()`, so the
swap didn't touch surrounding logic. Also paginated the Change history
panel (5 at a time, `loadMoreRecordHistoryQuery`, same cursor pattern as
the audit log's own "Load more") so a long-lived record's edit history
can't turn its detail page into an endless scroll. The other two
(consistent loading-state treatment across every mutating button, a
deliberate color-vocabulary audit across every status badge) were
deliberately deferred — lower payoff for the effort right now, better
done once real usage shows which parts of the UI actually get touched
most.

### Qatar-specific items — confirm with client before building

- **End of service gratuity** — accrued liability per employee (E4, above).
- **WPS** — payroll must export in the bank's required SIF format. CBQ
  done (Phase F); QNB layout done (Phase F2), pending the company's own
  QNB establishment number and account IBAN.
- **Residence permit / QID expiry** — hard compliance item, same alerting
  tier as other documents, escalated harder (E1).
- **Annual leave entitlement** under Qatar Labour Law, and how the company
  actually applies it (statutory floor vs. what they actually give).
- **Air ticket allowance** — entitlement cycle per employee.

### Open questions — need answers before building the relevant piece

1. *(Resolved 2026-08-18)* ~~Do they employ any Qatari nationals?~~
   **Answered: no. GRSIA pension is confirmed out of scope for E6, whenever
   that's revisited.**
2. Which bank for WPS? The SIF format spec must come from that bank (E3) —
   still open, user will provide once known. Everything else in E3 is built
   and working; only the bank-specific export file itself is waiting on
   this answer.
3. Do they pay above statutory minimums anywhere — gratuity above 21 days,
   annual leave above 3 weeks? System should default to statutory, allow
   per-employee override (E4, E2). Still open — user needs to ask the
   client.
4. *(Resolved 2026-08-18)* ~~How are the 2 hours beyond the standard 8-hour
   day currently paid for operators — flat, or at overtime rate?~~
   **Answered: 125% (statutory minimum) — confirmed directly, and built into
   `src/lib/overtime.ts`/`src/lib/payroll.ts` exactly as stated: 0-8h
   regular, 8-10h at 125%, under 8h paid actual with no overtime, over 10h
   flagged rather than auto-paid.**
5. Air ticket entitlement cycle — every 1 year or 2, ticket or cash? (E5.)
   Still open — user needs to ask the business.
6. Is accommodation/food provided in kind or paid as allowance? Not
   answered — E3 defaults to NOT in kind (the stricter minimum-wage check)
   per employee, overridable via the "provided in kind" checkboxes on the
   employee form. User may be able to get this from employee contract
   paperwork rather than asking outright — still open.
7. *(Carried from the original Phase B doc, now resolved)* ~~H2S and
   Defensive Driving — one certificate or two?~~ **Answered: two separate
   records.**
8. *(Carried from the original Phase B doc, now resolved)* ~~Operators vs
   Employees — one table or two?~~ **Answered: single Employee table with a
   category field.**
9. *(Raised 2026-08-21, Phase E2)* When annual leave spans a Friday, does
   it consume 7 calendar days or 6 (Friday excluded as an existing rest
   day)? Built to calendar-days-including-Friday for now
   (`leaveDaysConsumed` in `src/lib/leave.ts`) — matches the statutory "3
   weeks = 21 days" phrasing literally. Still open — user needs to ask the
   business.
10. *(Raised 2026-08-21, Phase E2)* Is sick leave's 3-tier pay rule (2wk
    full / 4wk half / remainder unpaid) tracked cumulatively across the
    service year, or reset per illness spell? Built cumulative
    (`sickLeavePayTiers`). Still open — user needs to ask the business.
11. *(Raised 2026-08-21, Phase E2)* Should Emergency leave be paid or
    unpaid by default — it isn't in the statutory articles, it's a company
    benefit. Built unpaid by default, overridable per request. Still open
    — user needs to ask the business.
12. *(Raised 2026-08-21, built 2026-08-21/22)* ~~Role-based access
    control~~ — see **Phase F** below. Foundation, server-side enforcement,
    payroll lockdown, audit trail and user management are done; UI-level
    button-hiding is only partially rolled out across the app. Not fully
    resolved — see Phase F for exactly what's left.
13. *(Raised 2026-08-21, CBQ built 2026-08-22, QNB built 2026-09-26)*
    ~~WPS export, per-bank~~ — both layouts now built from real sample
    files, neither guessed. Not fully closed: QNB needs the company's own
    establishment number and account IBAN entered before it can produce a
    file. See **Phase F** and **Phase F2**.

---

## PHASE F2 — QNB WPS export ✅ Done (2026-09-26)

Closes the one thing Phase F left explicitly blocked. Unblocked by a real
QNB SIF file turning out to be available after all, so the layout is
transcribed rather than guessed — the same standard CBQ was held to.

**Provenance, stated plainly because it matters.** The QNB sample belongs
to a **different employer** and is dated **August 2022**. Only its column
layout was taken from it — the header labels, the field order and three
formatting conventions. None of its contents were read into anything, and
none appear in this document or in code. Two consequences follow, and
both were accepted deliberately by the owner rather than treated as
blockers: the layout is real but **unverified for this employer**, and it
is **four years old**, so QNB may have changed the format since. The
instruction was to build it and let the business flag a mismatch if the
bank rejects the file, which is a better position than staying blocked
indefinitely.

**Each bank's layout is now data, not code.** `src/lib/wps.ts` grew a
`WPS_LAYOUTS` table holding both banks' header rows verbatim plus their
formatting quirks, and the two near-identical generators collapsed into
one `generateSif({ bank, ... })`. The reason is that the two layouts differ
almost entirely in **header label casing**, and a parser at a bank may
well be strict about exactly that:

| | CBQ | QNB |
|---|---|---|
| Employer column | `Employer QID` | `Employer EID` |
| Payer bank column | `Payer Bank Short` | `Payer Bank Short Name` |
| Record count column | `Total Records` | `Total records` |
| Employee bank column | `Employee Bank Short name` | `Employee Bank Short Name` |
| Working days column | `Number of Working days` | `Number of Working Days` |
| Overtime column | `Extra Hours` | `Extra hours` |
| Extra pay column | `Extra income` | `Extra Income` |
| Notes column | `Note / Comments` | `Notes / Comments` |
| Record Sequence | zero-padded to 5 | zero-padded to 6 |
| Total records value | zero-padded to 5 | plain count, not padded |
| Payment Type value | empty | `Normal Payment` |

Eight of those eleven differences are pure casing or pluralisation. Kept
as two separate literal arrays on purpose — a shared array with per-bank
overrides would have hidden precisely the detail that's most likely to
break.

**"Not configured" split into two distinct states.** Until now, "we don't
know this bank's file layout" and "we don't know our own account number"
were indistinguishable — one boolean covered both, which was fine while
they were the same problem and is wrong now. `wpsBankReadiness(bank)`
returns `READY`, `NEEDS_PAYER_DETAILS` or `NO_LAYOUT`, and the export page
tells the truth for each: QNB now reads *"File layout is ready — still
needs the company's own QNB establishment number and account IBAN"*
instead of implying the build isn't done.

**What's still needed for QNB to produce a file** — both go in
`WPS_PAYER_CONFIG.QNB`, no code changes:

1. **The company's QNB account IBAN.** Genuinely unknown.
2. **The establishment number.** Very likely the same `12943300` already
   used for CBQ, since it's the company's Ministry of Labour number rather
   than anything bank-specific — but *confirm rather than assume*, because
   a wrong number here means a rejected file.

**Verified structurally, not just compiled.** Generated both banks' files
from synthetic payslips and compared each against its own real sample:
payer header row, employee header row and both row widths match column for
column, for both banks. Also asserted `Basic + Extra income − Deductions =
Net Salary` on every generated row — true by construction, now actually
checked. CBQ's output format is unchanged by the refactor (still 5-wide
sequence, 5-wide padded total, empty Payment Type). The check was a
throwaway script, not kept: there is still no test framework in this
project, which stays the honest gap it has been since Phase A.

---

## Employee salary data — the gap behind payroll producing nothing

Raised by the owner on 2026-09-25: *"why do we not have salaries, I
provided you with the document previously."* Worth recording in full,
because it explains an otherwise baffling symptom and because part of the
answer is a judgment call I made and should own.

**The symptom.** A payroll period finalized in production with **zero
payslips**. Not a bug: `generatePayslipsForPeriod` selects employees
`where: { basicSalary: { not: null } }` and deliberately skips anyone
without a basic salary rather than zero-filling them
(`src/lib/actions/payroll.ts`). With nobody having a salary, it correctly
skipped everybody.

**Why nobody has one.** Two separate reasons, and both are true:

1. **The staff list genuinely had no pay in it.** The roster imported on
   2026-08-18 (`scripts/import-employees.ts`) came from a spreadsheet with
   exactly four columns — serial number, staff number, name, designation.
   Everything on that sheet was imported. There was no salary column to
   miss.
2. **The CBQ SIF sample did have salaries, and I chose not to use them.**
   It carries basic salary, extra income, deductions, net pay and bank
   accounts for 49 people. I treated it strictly as a **format
   specification** because the instruction was to treat its contents as
   sensitive, and never considered it as a data source. That was my call,
   it was never flagged at the time, and it is the actual reason the
   numbers aren't in the system.

**Why importing from that CBQ file anyway is the wrong fix.** Two
independent problems:

- **No key to join on.** The bank file identifies people by Qatar ID; the
  roster identifies them by staff number. Neither file carries both, and
  `Employee` has no QID field — QIDs live in `Document` records. Matching
  on name spelling gives 23 exact matches out of 49, 12 loose matches
  needing a human eye, and **14 that don't match at all** (transliteration
  varies enough that some share no words with any roster name). A
  mis-pairing puts one man's salary on another man's record. Not a risk
  worth taking with wages.
- **The allowance breakdown isn't in it.** The bank file has basic salary,
  one lump "extra income" and deductions. `Employee` stores housing,
  transport, food, site and other allowances separately, because
  `checkMinimumWage` tests them against the Qatari statutory floors (QAR
  500 housing, QAR 300 food, unless provided in kind). Imported from the
  bank file, every employee would come up flagged short on housing and
  food — not because they are, but because the split isn't there to read.

**Decision: ask the business for one spreadsheet instead**, keyed on
**staff number** (the business's own unambiguous identifier), carrying
basic salary; housing / transport / food / site / other allowance split
out; whether housing and food are provided in kind (likely yes for
camp-based staff — `housingProvidedInKind` and `foodProvidedInKind` exist
for exactly this); bank name and IBAN or wage card number; and date of
joining, which is empty for all 50 and is required by both leave
entitlement and E4 gratuity. Keyed that way it imports with no guessing.
The import script is not written yet — waiting on the file, deliberately,
rather than building against an assumed shape.

---

## Staff list merged onto the live records ✅ Done (2026-11-06)

Closes the gap found on 2026-10-03: the staff list supplied 2026-08-18 had
been imported into the **development** database only, while the live system
carried 28 records entered by hand by Muhideen — all filed as OPERATOR, all
with `employeeNumber` blank, eleven with the staff number written inside
the NAME ("LATIF GUL (5454)").

`scripts/merge-staff-list.ts`, run with `--apply` against production by the
owner. **27 of 28 records updated**: staff number moved out of the name into
its own field, job title filled in from the spreadsheet, four misspellings
corrected. Verified afterwards — 27 with a staff number, 27 with a job
title, **zero** still carrying a number inside the name, and the document
count unchanged at 252 (149 on employees, 103 on equipment). No record was
created or deleted; deletions ever recorded is still 0.

The hand-entered records were treated as the authoritative side and merged
INTO, never replaced — they hold the phone numbers, nationalities, notes,
in-house/market flag, 149 documents and 14 job assignments, none of which
is on the spreadsheet. (An earlier note in this session put the employee
document count at 141; that was an arithmetic slip — it was 149 all along.)

Owner's rules, applied as given: the spreadsheet wins on spelling; longer
names already on the record are kept, since a fuller name is not a
misspelling; a staff number written into a name moves to its proper field.

**Shehzad Khan Sultan Muhannad** is on the live system (3 documents, 1 job
assignment) but not on the spreadsheet, so he was left entirely untouched
and keeps the "Missing staff number" flag until the business supplies one.

**Job title vs. "Qualified to operate".** The spreadsheet's DESIGNATION
column holds the machine name for operators ("Backhoe Loader"), which is
the business's own word for the role and is what went into `jobTitle`. It
is not the same as `OperatorQualification`, the separate list of machines
a man is cleared to run — which is empty for all 28 and is not decoration:
it drives which machine-specific certificates `computeCompleteness`
demands. With it empty, nobody is currently asked for any machine
certificate. Not filled from the spreadsheet, because one designation per
man probably understates what each can operate; left for the owner to
decide whether to seed it as a baseline or have Muhideen set it.

**Next, agreed with the owner**: add the 23 people who are on the
spreadsheet but absent from the live system — all 12 workshop staff, 4
office, 2 management, 2 drivers, 3 helpers. The merge script never creates
anyone by design, so this needs its own pass. The point is to spare
Muhideen 23 records of manual entry.

### Correction: the CBQ file IS usable as a salary source

On 2026-10-03 this document recorded that salaries could not be imported
from the CBQ SIF sample because there was "no key to join on" — the file
identifies people by Qatar ID and `Employee` has no QID field, so only name
matching was left, which was correctly judged too risky for wages.

**That conclusion was wrong.** `Employee` has no QID field, but the QID is
recorded on every employee as a `Document` of type "Qatar ID" with its
`documentNumber` filled in — all 28 of them. That is an exact key, a
government ID number rather than a name with three spellings.

Measured against production on 2026-11-06: **24 of the 28 live employees
match a row in the CBQ file by Qatar ID**, and all 24 of those rows carry
both a basic salary and a bank account number — enough to make payroll
produce real payslips instead of an empty file.

The genuine limitation stands and is smaller than it looked: the bank file
carries basic salary, one lump "extra income" and deductions, but **not**
the housing / transport / food / site split that `checkMinimumWage` tests
against the statutory floors (QAR 500 housing, QAR 300 food unless provided
in kind). Imported as-is, every employee would show short on housing and
food — not because they are, but because the split isn't in the file. Four
of the 28 have no row in it at all.

Sequence agreed: merge (done) → add the missing 23 → import salaries and
bank accounts for the 24 matched by QID → ask the business only for what is
genuinely missing (the allowance split, joining dates, and the four people
absent from the bank file). That reduces a long data-entry request to one
short question.

Sensitive handling unchanged: the CBQ sample's contents are never
reproduced in this document, in code, or in chat — only counts.

**Decision (owner, 2026-11-09): housing and food are assumed provided in
kind for every employee.** When salaries are imported, every employee —
the 28 existing and the 23 being added — gets `housingProvidedInKind` and
`foodProvidedInKind` set to true. Muhideen then switches it off for
anyone who is actually paid those allowances in cash.

This reverses the schema's original default. `Employee` defaults both
flags to false on purpose — the stricter check, "per owner confirmation
rather than assumed". The owner has now confirmed the opposite default,
which matches the reality for camp-based staff and stops every payslip
being flagged short on housing and food simply because the bank file has
no allowance split.

The trade-off, stated so it isn't lost: with the flag on,
`checkMinimumWage` no longer tests that person's housing and food
allowances against the statutory floors (QAR 500 / QAR 300). For anyone
who is in fact paid those in cash below the floor, the system will stay
silent — catching that now depends on Muhideen correcting the flag for
the exceptions.
