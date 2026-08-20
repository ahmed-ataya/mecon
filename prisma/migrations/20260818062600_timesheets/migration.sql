-- CreateTable
CREATE TABLE "EquipmentTimesheet" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "equipmentAssignmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentTimesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentTimesheetDay" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "workingHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdownHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "EquipmentTimesheetDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorTimesheet" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "operatorAssignmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorTimesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorTimesheetDay" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "workingHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdownHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "OperatorTimesheetDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentTimesheet_referenceNumber_key" ON "EquipmentTimesheet"("referenceNumber");

-- CreateIndex
CREATE INDEX "EquipmentTimesheet_equipmentAssignmentId_idx" ON "EquipmentTimesheet"("equipmentAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentTimesheet_equipmentAssignmentId_year_month_key" ON "EquipmentTimesheet"("equipmentAssignmentId", "year", "month");

-- CreateIndex
CREATE INDEX "EquipmentTimesheetDay_timesheetId_idx" ON "EquipmentTimesheetDay"("timesheetId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentTimesheetDay_timesheetId_date_key" ON "EquipmentTimesheetDay"("timesheetId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorTimesheet_referenceNumber_key" ON "OperatorTimesheet"("referenceNumber");

-- CreateIndex
CREATE INDEX "OperatorTimesheet_operatorAssignmentId_idx" ON "OperatorTimesheet"("operatorAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorTimesheet_operatorAssignmentId_year_month_key" ON "OperatorTimesheet"("operatorAssignmentId", "year", "month");

-- CreateIndex
CREATE INDEX "OperatorTimesheetDay_timesheetId_idx" ON "OperatorTimesheetDay"("timesheetId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorTimesheetDay_timesheetId_date_key" ON "OperatorTimesheetDay"("timesheetId", "date");

-- AddForeignKey
ALTER TABLE "EquipmentTimesheet" ADD CONSTRAINT "EquipmentTimesheet_equipmentAssignmentId_fkey" FOREIGN KEY ("equipmentAssignmentId") REFERENCES "EquipmentAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentTimesheetDay" ADD CONSTRAINT "EquipmentTimesheetDay_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "EquipmentTimesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorTimesheet" ADD CONSTRAINT "OperatorTimesheet_operatorAssignmentId_fkey" FOREIGN KEY ("operatorAssignmentId") REFERENCES "OperatorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorTimesheetDay" ADD CONSTRAINT "OperatorTimesheetDay_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "OperatorTimesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
