-- CreateEnum
CREATE TYPE "DianActivationStatus" AS ENUM ('PENDING', 'ACTIVATED');

-- AlterTable
ALTER TABLE "DianConfig" ADD COLUMN     "activationStatus" "DianActivationStatus" DEFAULT 'PENDING';
