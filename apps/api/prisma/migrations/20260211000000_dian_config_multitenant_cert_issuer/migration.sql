-- AlterTable DianConfig: add issuer data, encrypted cert fields and cert validity; make softwareId/softwarePin optional for incomplete config.
ALTER TABLE "DianConfig" ADD COLUMN IF NOT EXISTS "issuerNit" TEXT;
ALTER TABLE "DianConfig" ADD COLUMN IF NOT EXISTS "issuerName" TEXT;
ALTER TABLE "DianConfig" ADD COLUMN IF NOT EXISTS "certEncrypted" TEXT;
ALTER TABLE "DianConfig" ADD COLUMN IF NOT EXISTS "certPasswordEncrypted" TEXT;
ALTER TABLE "DianConfig" ADD COLUMN IF NOT EXISTS "certValidUntil" TIMESTAMPTZ;

ALTER TABLE "DianConfig" ALTER COLUMN "softwareId" DROP NOT NULL;
ALTER TABLE "DianConfig" ALTER COLUMN "softwarePin" DROP NOT NULL;
