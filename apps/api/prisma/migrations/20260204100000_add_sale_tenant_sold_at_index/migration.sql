-- CreateIndex (composite: consultas de ventas por tenant ordenadas por fecha)
CREATE INDEX IF NOT EXISTS "Sale_tenantId_soldAt_idx" ON "Sale"("tenantId", "soldAt");
