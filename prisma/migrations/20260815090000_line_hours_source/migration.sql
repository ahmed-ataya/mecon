-- Records where a line's hours came from: a calendar estimate or a timesheet.
--
-- Left NULL for existing rows rather than backfilled to 'ESTIMATE'. Every one
-- of them WAS estimated, but writing that in would be inventing a provenance
-- claim about invoices raised before the distinction was tracked. NULL says
-- "not recorded", which is the truth, and the UI reads it as unverified either
-- way.
ALTER TABLE "InvoiceLineItem" ADD COLUMN "hoursSource" TEXT;
