-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN "relatedExpenseId" UUID;

-- CreateIndex
CREATE INDEX "CashMovement_relatedExpenseId_idx" ON "CashMovement"("relatedExpenseId");

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_relatedExpenseId_fkey" FOREIGN KEY ("relatedExpenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
