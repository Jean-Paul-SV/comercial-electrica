-- CreateEnum
CREATE TYPE "BackupScope" AS ENUM ('TENANT', 'PLATFORM');

-- AlterTable
ALTER TABLE "BackupRun" ADD COLUMN "scope" "BackupScope" NOT NULL DEFAULT 'TENANT';

-- CreateIndex
CREATE INDEX "BackupRun_scope_idx" ON "BackupRun"("scope");
