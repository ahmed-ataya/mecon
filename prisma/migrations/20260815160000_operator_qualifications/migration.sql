-- B2: which equipment types an operator is qualified to run.
CREATE TABLE "OperatorQualification" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorQualification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperatorQualification_operatorId_idx" ON "OperatorQualification"("operatorId");

CREATE UNIQUE INDEX "OperatorQualification_operatorId_equipmentType_key" ON "OperatorQualification"("operatorId", "equipmentType");

ALTER TABLE "OperatorQualification" ADD CONSTRAINT "OperatorQualification_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
