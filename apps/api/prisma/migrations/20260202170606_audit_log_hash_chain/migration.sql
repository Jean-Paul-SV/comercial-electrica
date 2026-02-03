-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "entryHash" VARCHAR(64),
ADD COLUMN     "previousHash" VARCHAR(64);
