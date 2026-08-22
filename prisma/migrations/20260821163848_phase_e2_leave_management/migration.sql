-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "annualLeaveEntitlementOverrideDays" INTEGER,
ADD COLUMN     "dateOfExit" TIMESTAMP(3),
ADD COLUMN     "dateOfJoining" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OperatorTimesheetDay" ADD COLUMN     "dayType" TEXT NOT NULL DEFAULT 'WORKING',
ADD COLUMN     "leaveType" TEXT;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "paidLeaveHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unpaidLeaveHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "decidedDate" TIMESTAMP(3),
    "paidOverride" BOOLEAN,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicHoliday_startDate_idx" ON "PublicHoliday"("startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_leaveType_idx" ON "LeaveRequest"("leaveType");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
