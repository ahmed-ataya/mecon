-- E0: Operator becomes Employee at the Prisma model level, pulled forward
-- from Phase E — see ROADMAP.md. The physical table stays "Operator"
-- (@@map in schema.prisma), so this is purely additive: one new column,
-- one index. No data moves, no existing column changes.
ALTER TABLE "Operator" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OPERATOR';

CREATE INDEX "Operator_category_idx" ON "Operator"("category");
