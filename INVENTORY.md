# Inventory

A map of what exists, kept separate from NOTES.md (which is *why* things are
the way they are, not *what* things are) and from
[ROADMAP.md](ROADMAP.md) (which is *what's coming next*). Start here when the
question is "where does X live" rather than "why does X work this way."

This is meant to grow. It started with pickers because a whole class of bug
lived there and needed a record; add sections as they'd save the next lookup.

## Pickers (dropdowns, comboboxes)

Every closed-list or searchable picker in the app, what renders it, and
whether a real click and a real keyboard interaction have been driven through
it and confirmed to reach the underlying form value — not just confirmed to
display correctly.

Native `<select>` used to be the underlying element for the first group below.
Driven with real clicks and real keyboard input, it would sometimes open and
simply not commit whatever was clicked — confirmed against the DOM value, not
just the screen. `src/components/ui/Select.tsx` replaced all of them: same
technique `Combobox` already used successfully — an in-page option list
instead of the browser's native popup — with the search box removed since
these are short closed lists. See the commit `Replace every native <select>`
for the full account.

### Select.tsx (closed lists — replaced the broken native selects)

| Field | Component | File | Click | Keyboard |
|---|---|---|---|---|
| Certification applies (site regime) | `ContractForm` | `src/components/contracts/ContractForm.tsx` | ✅ | — |
| Certification applies (site regime) | `ContractDetailsForm` | `src/components/contracts/ContractDetailsForm.tsx` | shares `Select`, not re-clicked individually | — |
| Arrangement (with/without/market operator) | `ContractForm` | `src/components/contracts/ContractForm.tsx` | ✅ | ✅ |
| Charge (mobilization) | `MobilizationFields` | `src/components/contracts/MobilizationFields.tsx` | ✅ | — |
| Hire arrangement (rate type) | `RateFields` | `src/components/contracts/RateFields.tsx` | ✅ | — |
| Document type | `DocumentForm` | `src/components/documents/DocumentForm.tsx` | ✅ (incl. flip-up when near viewport bottom) | — |
| 3rd party type | `DocumentForm` | `src/components/documents/DocumentForm.tsx` | shares `Select`, not re-clicked individually | — |
| Capacity unit | `EquipmentForm` | `src/components/equipment/EquipmentForm.tsx` | ✅ | — |
| Source (in-house/market) | `OperatorForm` | `src/components/operators/OperatorForm.tsx` | ✅ | — |
| Reason (replace machine) | `EquipmentTimeline` | `src/components/contracts/EquipmentTimeline.tsx` | shares `Select`, not re-clicked individually | — |
| Arrangement (replace operator) | `OperatorTimeline` | `src/components/contracts/OperatorTimeline.tsx` | shares `Select`, not re-clicked individually | — |
| Reason (replace operator) | `OperatorTimeline` | `src/components/contracts/OperatorTimeline.tsx` | shares `Select`, not re-clicked individually | — |

"Shares `Select`, not re-clicked individually" means: same component, same
interaction code as a row that *was* individually driven and confirmed. Not
tested blind — tested by construction. If one of these starts misbehaving
without the shared component changing, that would be a genuinely new finding
worth its own row and its own fix.

### Combobox.tsx (searchable — never had the native-popup problem)

Renders its own in-page list the same way `Select` now does; that is *why* it
was never affected. Listed for completeness of "every dropdown," not because
anything here needed fixing.

| Field | Used in | Click-verified |
|---|---|---|
| Customer | Contract new/edit, LPO new, Invoice generate | ✅ (multiple sessions) |
| Equipment | Contract new, replace-machine panel | ✅ |
| Operator | Contract new, replace-operator panel | not this pass — unchanged code, low risk |
| Location (free text) | Contract new/edit | ✅ |
| LPO | Contract new/edit, Invoice generate | not this pass — unchanged code, low risk |
| Mobilized by (free text) | `MobilizationFields` | not this pass — unchanged code, low risk |

### Not a dropdown, listed to rule it out

`GenerateForm`'s "how to split the period" control (`SplitChoice`) is radio
buttons, not a select — included here only so nobody re-checks it looking for
a missed dropdown.

## Money and billing

- **Rate storage**: `EquipmentAssignment.rateAmount` is the HOURLY rate, in
  integer halalas, always — see `src/lib/money.ts`. `rateType`
  (`PER_MONTH`/`PER_WEEK`/`PER_DAY`) is the hire's *arrangement*, not a divisor
  — see `src/lib/enums.ts`'s `RATE_TYPE_HOURS`/`RATE_TYPE_DAYS`.
- **Hours**: one source, `src/lib/hours.ts` (`hoursFor`). Today it's an
  estimate (working days × 10); timesheets replace only this function's body.
  Every line carries `hoursSource` (`ESTIMATE` | `TIMESHEET`) through to
  `InvoiceLineItem.hoursSource` in the database.
- **Rate audit**: `src/lib/rate-audit.ts` (`auditRateTier`). Flags a quoted
  period longer than the actual hire, one direction only. Surfaced twice:
  before generating (`GenerateForm`, computed live from the same two modules)
  and after (`buildProposal`'s warnings, attached to the invoice).
- **Billing engine**: `src/lib/billing.ts` (`buildProposal`). Walks assignment
  history, clamps to the contract span, one line per machine.
- **Invoice numbering**: `src/lib/invoice-number.ts`. System-raised numbers
  lead with `5`; pad numbers lead with `1`; trailing digits stay in step.

## Drafts

- **Contract drafts** (`src/lib/use-form-draft.ts`) live in the browser's
  `localStorage` only, one slot (`mecon:contract-draft`), never in the
  database. This is deliberate — a half-filled contract has no customer, no
  machine, no rate, and giving it a database row would mean defending every
  downstream calculation against a contract that isn't really one yet.
  Consequence: a contract draft cannot appear on a server-rendered list (it
  doesn't exist anywhere the server can see), is per-browser/per-device, and
  there is only ever one at a time — starting a second before finishing the
  first overwrites it.
- **Invoice drafts** are a real `status: 'DRAFT'` row in the database (see the
  Invoices list's Drafts tab) — a completely different mechanism from the
  above despite the shared word. Don't assume contract drafts work the way
  invoice drafts do, or vice versa.
