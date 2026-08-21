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
  unworked. **Deferred**: needs Phase E2 (leave management), not built yet.
  Every day defaults to Working for now.

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
- **Leave pay and gratuity are out of scope** — both need Phase E2/E4,
  neither exists yet. Flagged here so it's a known gap, not a silent one.

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

### Qatar-specific items — confirm with client before building

- **End of service gratuity** — accrued liability per employee (E4, above).
- **WPS** — payroll must export in the bank's required SIF format.
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
