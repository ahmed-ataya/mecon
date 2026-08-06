# Design notes

Decisions a future maintainer would otherwise have to re-derive. Kept short.

## SQLite forces two things

Prisma does not support `enum` or scalar list fields on SQLite.

1. **Enums are strings.** Every enum in the spec is a `String` column. The
   source of truth is `src/lib/enums.ts` (value tuples + TS union types), and
   `src/lib/validation.ts` enforces them at runtime with zod. Nothing writes to
   the database without going through a zod schema — on SQLite that validation
   is the only thing preventing bad values.
2. **`Document.approvedFor` is a join table** (`DocumentApproval`) rather than
   an array column.

On the move to Postgres the strings become real enums; the join table stays.

## Documents are polymorphic via three FKs, not (ownerType, ownerId)

The spec described `ownerType` + `ownerId`. Prisma cannot express a relation
over an untyped `ownerId`, so `customer.documents` — which the spec asks for on
all three owners — would not be queryable, and there would be no referential
integrity.

Instead `Document` carries three nullable FKs (`customerId`, `equipmentId`,
`operatorId`) **plus** `ownerType` as an explicit discriminator. Relations and
cascade deletes work normally. The cost: "exactly one FK is set" is enforced in
the app layer (`src/lib/actions/documents.ts` maps owner type to the right FK),
not by the database.

## Status is always derived

Contract status, document validity and invoice `OVERDUE` are computed from
dates on every read, never stored, so they cannot go stale.

`Invoice.status` stores only the lifecycle the user controls — `DRAFT`,
`ISSUED`, `PAID`. `OVERDUE` is derived (`ISSUED && dueDate < today &&
paidDate == null`). Storing it would require a nightly job to stay truthful.

## Dates are UTC midnight, always

Qatar is UTC+3. A date-only value that passes through a local-timezone
conversion can shift by a day, which would corrupt the day counts that phase 3
billing depends on — the one place an off-by-one silently produces a wrong
invoice.

So: `src/lib/dates.ts` parses and formats purely from UTC components and never
touches local time. Client components never receive a `Date` object at all —
`src/lib/serialize-document.ts` converts to strings on the server. The SQLite
adapter is configured with `timestampFormat: 'iso8601'`, so dates are readable
ISO strings in the database file.

## Money is integer halalas

Floats are never safe for money and Prisma's `Decimal` loses precision on
SQLite, so amounts are stored as integers in the **smallest unit**: halalas
(1 riyal = 100 halalas). Rates and operator pay routinely carry a decimal —
137.50 per working hour is normal — and rounding those to whole riyals is not
acceptable, so riyals is too coarse a storage unit.

Every money column is halalas: `Contract.rateAmount`, `Contract.lpoAmount`,
`OperatorAssignment.operatorCost`, `OperatorAssignment.operatorRebill`,
`Invoice.totalAmount`, `InvoiceLineItem.unitRate`, `InvoiceLineItem.amount`.

`src/lib/money.ts` is the only place that converts. Nothing else should
multiply or divide by 100. Display shows decimals only when the amount has
halalas, so round figures stay clean (QAR 5,000) while real rates keep their
precision (QAR 137.50) — `formatAmountExact` forces two decimals for invoice
columns that need to line up.

## Forms echo their input back on failure

React resets a form once its action resolves, so a validation error would wipe
everything typed. Both server actions return the submitted `values` alongside
`errors`, and the forms prefer those over the stored record when repopulating.
Without this, one bad date costs the user the whole form.

### `<select>` needs more than the echo — read this before adding one

Echoing values back is enough for text inputs, because React writes their
`defaultValue` as a real DOM **attribute** and a form reset restores from
attributes. A `<select>` behaves differently: React applies its value as a DOM
**property** and never sets `selected` on the option, so the reset always snaps
it back to the first entry.

Left unhandled that is a silent data bug, not a cosmetic one. In the document
form it meant that after a validation error the type select displayed (and
would submit) the first document type, while the 3rd party fields were still on
screen — saving the wrong type with the certificate details stripped, with
nothing on screen to suggest anything was wrong.

The fix in `DocumentForm.tsx` is to hold the value in state and re-apply it to
the element after every commit:

```ts
const typeSelectRef = useRef<HTMLSelectElement>(null)
useEffect(() => {
  if (typeSelectRef.current) typeSelectRef.current.value = documentType
})
```

Checkboxes have the same problem for the same reason. **Phase 2's contract form
is mostly selects** — site, rate type, assignment reason, plus the searchable
customer/equipment/operator pickers — so every one of them needs this treatment
or the same class of bug returns.

## Prisma 7 specifics

Prisma 7 removed `url` from the schema's `datasource` block. The connection
string now lives in `prisma.config.ts` for migrations, and is passed to a
driver adapter at runtime in `src/lib/db.ts`. Prisma 7 also no longer loads
`.env` automatically — `prisma.config.ts` and `prisma/seed.ts` both import
`dotenv/config` themselves.

## Commands

```bash
npm run dev        # dev server
npm run db:seed    # wipe and re-seed sample data
npm run db:studio  # browse the database
npm run typecheck  # tsc --noEmit
```
