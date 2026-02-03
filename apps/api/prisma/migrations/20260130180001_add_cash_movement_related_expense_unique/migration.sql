/*
  Warnings:

  - A unique constraint covering the columns `[relatedExpenseId]` on the table `CashMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex (IF EXISTS por si el índice ya fue eliminado en un estado previo)
DROP INDEX IF EXISTS "CashMovement_relatedExpenseId_idx";

-- CreateIndex (IF NOT EXISTS por idempotencia)
CREATE UNIQUE INDEX IF NOT EXISTS "CashMovement_relatedExpenseId_key" ON "CashMovement"("relatedExpenseId");
