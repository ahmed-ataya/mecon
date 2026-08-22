# Design notes

Decisions a future maintainer would otherwise have to re-derive. Kept short.

## Enums are strings, approvedFor is a join table

Both started as SQLite limitations (Prisma supports neither `enum` nor scalar
lists there). We are on Postgres now and both are being kept deliberately.

1. **Enums are strings.** Every enum in the spec is a `String` column. The
   source of truth is `src/lib/enums.ts` (value tuples + TS union types), and
   `src/lib/validation.ts` enforces them at runtime with zod. Nothing writes to
   the database without going through a zod schema. Converting to native
   Postgres enums is a typed refactor across every read, write and zod schema
   for no behavioural gain, so it has not been done.
2. **`Document.approvedFor` is a join table** (`DocumentApproval`) rather than
   an array column — the better model regardless of provider.

## We moved off SQLite to deploy

SQLite cannot back a serverless deployment: the filesystem is ephemeral, so the
database file is wiped on every deploy and is not shared between instances.
Postgres (Neon) replaced it when the app first went live.

Two things bit during that move, both worth remembering:

- **`contains` is case-sensitive on Postgres.** SQLite's `LIKE` is not, so all
  eleven search filters silently half-broke — "diar" stopped matching "Qatari
  Diar". Every one now passes `mode: 'insensitive'`. Any new search filter
  needs it too.
- **The migration had to be regenerated.** The original migration was SQLite
  DDL and will not run on Postgres. `prisma/migrations/` was rebuilt from the
  schema with `prisma migrate diff --from-empty --to-schema`.

## Seeding refuses to run over existing data

`prisma/seed.ts` deletes every record before inserting. That was harmless when
the only database was a local `dev.db`, but it is now pointed at a shared
database that people are entering real data into. It aborts if the target
already has customers; `FORCE_SEED=1` overrides. Do not remove that guard, and
do not put the seed in the build command.

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

## Audit diffs are formatted at write time, not read time

`AuditLog.changedFields` stores `{ field, was, now }[]`, and `was`/`now` are
already-formatted display strings (`formatQar(3800_00)` → `"QAR 38.00"`,
not the raw `380000`) at the moment `logAudit()` is called — not raw values
reformatted when the audit page later renders them.

This is deliberate, not an oversight: a stored diff must never reword itself
retroactively if a formatter's output format changes later (say `formatQar`
starts showing a currency symbol). An audit trail that can silently rewrite
its own history defeats the point of keeping one. The cost is that
`src/lib/audit.ts`'s `diffField`/`createdField`/`fmt` helpers have to be
called at every write site instead of centralizing formatting in one place
— accepted on purpose.

`CREATE` stores `was: null`; `DELETE` stores `now: null` — deliberately the
same two-value shape as `CREATE`, not a third shape, so `DiffTable` only
needs to branch on "one value" vs "two values," not on the action.

## Audit payloads: what's safe to log, what never gets logged

- Truncated to 200 characters (`MAX_FIELD_LENGTH` in `src/lib/audit.ts`) —
  long free-text fields (notes, remarks) get a diff entry, not their full
  contents.
- File contents and URLs are never stored: `documents.ts` logs a document's
  `fileName`, never its `fileUrl` (a Vercel Blob URL is itself a bearer
  credential — logging it would let anyone with audit-log read access
  download the file).
- Passwords are never stored, in any form: `users.ts` logs only a
  `{ field: 'Password', was: null, now: 'Reset' }` marker when a new
  password was set, never the value.
- Not every column — meaningful fields only. A timesheet day-row edit logs
  "Total working hours: 240 → 236," not one diff row per day. Deciding
  "meaningful" is a per-action-file judgment call, not a rule a linter could
  enforce; if a field feels worth showing a human reviewing the log, it's
  worth diffing.

## Model names and record links are centralized, not per-page

`src/lib/audit-model.ts`'s `humanizeModelName` (`"PayrollPeriod"` → `"Payroll
period"`) and `recordHref` (`entityType` → that record's own detail-page URL,
or `null` for `DELETE` rows and models with no standalone page) are the only
place either translation happens. Both the audit log list and every record's
own "Change history" panel (`RecordHistoryPanel`) import from here — adding
a new auditable model means adding one entry to `MODEL_LABELS`/`RECORD_HREF`
here, not touching both call sites separately and risking them drifting
apart (one says "Payroll Period," the other says "Payroll period").

## Resetting React state when props change — remount via `key`, not an effect

`useState(initialValue)` only reads `initialValue` on first mount. A parent
re-render that passes new props does **not** reset already-mounted state —
this bit twice in the audit/shell work: `Sidebar`'s mobile nav needed to
close when the route changed, and `AuditEntryList`'s row list needed to
reset when the URL filters changed (typing a search term updated the URL
and the server-computed count, but the visible rows silently kept the old
filtered set — a real bug, caught live).

`useEffect(() => setOpen(false), [pathname])` looks like the obvious fix but
trips the `react-hooks/set-state-in-effect` lint rule and is one render
behind besides. Two fixes, matched to the situation:

- **Full remount**: give the component a `key` tied to whatever should reset
  it — `key={JSON.stringify(filters)}` on `<AuditEntryList>` in
  `src/app/admin/audit/page.tsx`. React tears down and reinitializes state
  from scratch. Right when the component has no state worth preserving
  across the change (an accumulated "Load more" list should be discarded on
  a new filter anyway).
- **Adjust state during render**: track the previous value of the prop being
  watched and compare on every render, calling `setState` conditionally in
  the render body itself (not inside an effect) — see `Sidebar.tsx`'s
  `trackedPathname` pattern. Right when the component has other state that
  should survive.

## Prisma 7 specifics

Prisma 7 removed `url` from the schema's `datasource` block. The connection
string now lives in `prisma.config.ts` for migrations, and is passed to a
driver adapter at runtime in `src/lib/db.ts`. Prisma 7 also no longer loads
`.env` automatically — `prisma.config.ts` and `prisma/seed.ts` both import
`dotenv/config` themselves.

## Creating an isolated Neon branch for feature work

`npx neonctl@latest` works without a global install. It needs an API key
(Neon console → account settings → API keys), passed as `--api-key` or
via `NEON_API_KEY` — kept in `.env` (gitignored), never in chat or in a
committed file. `neonctl projects list --api-key "$KEY"` prompts
interactively for an org unless you also pass `--org-id`; get the org id
from that same prompt's output or the Neon console's URL.

This project's Neon org has two projects; **`Mecon-dev`**
(`misty-recipe-07429781`) is the one `.env`'s `DATABASE_URL` points at —
confirm by matching the `proxy_host` in `projects list` output against the
host in the current `DATABASE_URL`. Its only branch, `production`
(`br-rapid-frost-axh01e2v`), is the shared local-dev database everyone's
local `.env` already points at by default — not the deployed site's own
database (a separate concern; see `.env`'s own warning comment), but still
shared across whoever's doing local dev at the time.

To fork off it for isolated feature work:

```bash
npx neonctl@latest branches create --api-key "$NEON_API_KEY" \
  --project-id misty-recipe-07429781 --name <branch-name> --parent production
```

The response includes a ready-to-use pooled connection string
(`...-pooler.c-4.us-east-2.aws.neon.tech`). Swap it into `.env`'s
`DATABASE_URL`, keeping the old value commented alongside it for an easy
revert. A fresh branch inherits the parent's full schema and data as of
that moment — `npx prisma migrate status` should read "up to date"
immediately, with no need to re-run migrations.

## Commands

```bash
npm run dev        # dev server
npm run db:seed    # wipe and re-seed sample data
npm run db:studio  # browse the database
npm run typecheck  # tsc --noEmit
```
