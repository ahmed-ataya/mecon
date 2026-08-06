-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serialNumber" TEXT,
    "plateNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "nationality" TEXT,
    "source" TEXT NOT NULL DEFAULT 'IN_HOUSE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "customerId" TEXT,
    "equipmentId" TEXT,
    "operatorId" TEXT,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isApplicable" BOOLEAN NOT NULL DEFAULT true,
    "filePath" TEXT,
    "thirdPartyType" TEXT,
    "issuingCompany" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentApproval" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "DocumentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "mobilizationDate" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3),
    "rateType" TEXT NOT NULL,
    "rateAmount" INTEGER NOT NULL,
    "lpoNumber" TEXT,
    "lpoValidity" TIMESTAMP(3),
    "lpoAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAssignment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT 'INITIAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorAssignment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "operatorId" TEXT,
    "arrangement" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT 'INITIAL',
    "operatorCost" INTEGER,
    "operatorRebill" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "issuedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paidDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "equipmentAssignmentId" TEXT,
    "operatorAssignmentId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitRate" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Equipment_name_idx" ON "Equipment"("name");

-- CreateIndex
CREATE INDEX "Equipment_type_idx" ON "Equipment"("type");

-- CreateIndex
CREATE INDEX "Operator_name_idx" ON "Operator"("name");

-- CreateIndex
CREATE INDEX "Document_customerId_idx" ON "Document"("customerId");

-- CreateIndex
CREATE INDEX "Document_equipmentId_idx" ON "Document"("equipmentId");

-- CreateIndex
CREATE INDEX "Document_operatorId_idx" ON "Document"("operatorId");

-- CreateIndex
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

-- CreateIndex
CREATE INDEX "DocumentApproval_documentId_idx" ON "DocumentApproval"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentApproval_documentId_body_key" ON "DocumentApproval"("documentId", "body");

-- CreateIndex
CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");

-- CreateIndex
CREATE INDEX "Contract_site_idx" ON "Contract"("site");

-- CreateIndex
CREATE INDEX "Contract_mobilizationDate_idx" ON "Contract"("mobilizationDate");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_contractId_idx" ON "EquipmentAssignment"("contractId");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_equipmentId_idx" ON "EquipmentAssignment"("equipmentId");

-- CreateIndex
CREATE INDEX "OperatorAssignment_contractId_idx" ON "OperatorAssignment"("contractId");

-- CreateIndex
CREATE INDEX "OperatorAssignment_operatorId_idx" ON "OperatorAssignment"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_contractId_idx" ON "Invoice"("contractId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorAssignment" ADD CONSTRAINT "OperatorAssignment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorAssignment" ADD CONSTRAINT "OperatorAssignment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_equipmentAssignmentId_fkey" FOREIGN KEY ("equipmentAssignmentId") REFERENCES "EquipmentAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_operatorAssignmentId_fkey" FOREIGN KEY ("operatorAssignmentId") REFERENCES "OperatorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

