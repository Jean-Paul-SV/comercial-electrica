/*
  Warnings:

  - You are about to drop the column `kind` on the `Expense` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Expense_kind_idx";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "kind";

-- DropEnum
DROP TYPE "ExpenseKind";
