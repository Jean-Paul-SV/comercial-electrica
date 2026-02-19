-- AlterTable Subscription: add scheduled plan change for downgrades (Spotify-style).
ALTER TABLE "Subscription" ADD COLUMN "scheduledPlanId" UUID;
ALTER TABLE "Subscription" ADD COLUMN "scheduledChangeAt" TIMESTAMPTZ;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_scheduledPlanId_fkey" FOREIGN KEY ("scheduledPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Subscription_scheduledChangeAt_idx" ON "Subscription"("scheduledChangeAt");
