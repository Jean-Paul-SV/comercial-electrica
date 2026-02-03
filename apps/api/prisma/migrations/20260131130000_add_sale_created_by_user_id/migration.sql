-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "createdByUserId" UUID;

-- CreateIndex
CREATE INDEX "Sale_createdByUserId_idx" ON "Sale"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
