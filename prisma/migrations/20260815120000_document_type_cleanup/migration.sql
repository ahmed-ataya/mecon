-- A1: customer document types replaced entirely. Existing rows are
-- remigrated to the new list, never dropped — see src/lib/enums.ts.
UPDATE "Document" SET "documentType" = 'Commercial License'
  WHERE "ownerType" = 'CUSTOMER' AND "documentType" = 'Trade License';

UPDATE "Document" SET "documentType" = 'CR (Commercial Registration)'
  WHERE "ownerType" = 'CUSTOMER' AND "documentType" = 'Commercial Registration';

UPDATE "Document" SET "documentType" = 'Computer Card'
  WHERE "ownerType" = 'CUSTOMER' AND "documentType" = 'Company ID / CR Extract';

-- No equivalent in the new list for either of these.
UPDATE "Document" SET "documentType" = 'Other'
  WHERE "ownerType" = 'CUSTOMER' AND "documentType" IN ('VAT Certificate', 'Insurance Certificate');

-- A2: Gate Pass is not an equipment concept (it belongs to the person on
-- site) and Inspection Report was never actually used. Load Test Certificate
-- is renamed, not removed.
UPDATE "Document" SET "documentType" = 'Load Test'
  WHERE "ownerType" = 'EQUIPMENT' AND "documentType" = 'Load Test Certificate';

UPDATE "Document" SET "documentType" = 'Other'
  WHERE "ownerType" = 'EQUIPMENT' AND "documentType" IN ('Gate Pass', 'Inspection Report');
