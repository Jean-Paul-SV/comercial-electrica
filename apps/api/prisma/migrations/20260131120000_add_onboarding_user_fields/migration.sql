-- AlterTable: User - onboarding status and completed at
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingStatus" VARCHAR(32);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMPTZ;
