-- Índices compuestos para listados de cotizaciones (filtro por estado y validez)
CREATE INDEX IF NOT EXISTS "Quote_tenantId_status_idx" ON "Quote"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Quote_tenantId_validUntil_idx" ON "Quote"("tenantId", "validUntil");
