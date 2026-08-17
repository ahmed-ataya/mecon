-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "certifiedEquipmentType" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "otherLabel" TEXT;

-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "employeeNumber" TEXT;
