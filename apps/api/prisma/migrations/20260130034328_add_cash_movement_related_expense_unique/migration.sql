/*
  Warnings:

  - A unique constraint covering the columns `[relatedExpenseId]` on the table `CashMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CashMovement_relatedExpenseId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_relatedExpenseId_key" ON "CashMovement"("relatedExpenseId");
