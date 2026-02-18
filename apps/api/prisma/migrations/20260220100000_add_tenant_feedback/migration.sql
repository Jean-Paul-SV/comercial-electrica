-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'READ', 'DONE');

-- CreateTable
CREATE TABLE "TenantFeedback" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TenantFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantFeedback_tenantId_idx" ON "TenantFeedback"("tenantId");

-- CreateIndex
CREATE INDEX "TenantFeedback_userId_idx" ON "TenantFeedback"("userId");

-- CreateIndex
CREATE INDEX "TenantFeedback_status_idx" ON "TenantFeedback"("status");

-- CreateIndex
CREATE INDEX "TenantFeedback_createdAt_idx" ON "TenantFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "TenantFeedback" ADD CONSTRAINT "TenantFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeedback" ADD CONSTRAINT "TenantFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
