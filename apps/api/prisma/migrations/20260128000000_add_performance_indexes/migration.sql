-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryMovement_createdBy_idx" ON "InventoryMovement"("createdBy");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_validUntil_idx" ON "Quote"("validUntil");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DianDocument_createdAt_idx" ON "DianDocument"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CashSession_openedBy_idx" ON "CashSession"("openedBy");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
