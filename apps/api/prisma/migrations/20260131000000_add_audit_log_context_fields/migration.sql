-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "requestId" VARCHAR(64),
ADD COLUMN     "ip" VARCHAR(45),
ADD COLUMN     "userAgent" VARCHAR(500),
ADD COLUMN     "severity" VARCHAR(20),
ADD COLUMN     "category" VARCHAR(20);

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
