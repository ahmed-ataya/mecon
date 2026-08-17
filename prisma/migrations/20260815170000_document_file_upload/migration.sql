-- Phase C: file attachments via Vercel Blob. filePath was never used
-- (written for a local storage/ directory that was abandoned before it
-- shipped), so this drops it rather than migrating any data — there is none.
ALTER TABLE "Document" DROP COLUMN "filePath";

ALTER TABLE "Document" ADD COLUMN "fileUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN "fileName" TEXT;
ALTER TABLE "Document" ADD COLUMN "fileType" TEXT;
