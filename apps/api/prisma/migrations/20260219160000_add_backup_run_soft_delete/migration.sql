-- AlterTable BackupRun: add soft delete (deletedAt) para prevenir abuso de límites semanales
ALTER TABLE "BackupRun" ADD COLUMN "deletedAt" TIMESTAMPTZ;

CREATE INDEX "BackupRun_deletedAt_idx" ON "BackupRun"("deletedAt");
