-- CreateEnum
CREATE TYPE "ExpenseKind" AS ENUM ('FIXED', 'VARIABLE', 'OTHER');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "kind" "ExpenseKind";

-- CreateIndex
CREATE INDEX "Expense_kind_idx" ON "Expense"("kind");
