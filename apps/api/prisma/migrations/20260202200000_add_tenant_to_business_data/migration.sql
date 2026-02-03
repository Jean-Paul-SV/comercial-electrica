-- Aislamiento multi-tenant: añadir tenantId a datos de negocio y asignar tenant por defecto a datos existentes.
-- Requiere que exista un tenant con slug 'default' (seed lo crea); si no existe, se crea aquí.

INSERT INTO "Tenant" (id, name, slug, "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Default', 'default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" WHERE slug = 'default');

-- Helper: variable no disponible en PostgreSQL en scripts normales, usamos subquery (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) donde haga falta.

-- 1) Category: añadir tenantId, backfill, NOT NULL, FK, único por tenant
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Category" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Category" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "Category_tenantId_idx" ON "Category"("tenantId");
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Product" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "Product_internalCode_key";
CREATE UNIQUE INDEX "Product_tenantId_internalCode_key" ON "Product"("tenantId", "internalCode");
CREATE INDEX IF NOT EXISTS "Product_tenantId_idx" ON "Product"("tenantId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Customer
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Customer" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "Customer_docType_docNumber_key";
CREATE UNIQUE INDEX "Customer_tenantId_docType_docNumber_key" ON "Customer"("tenantId", "docType", "docNumber");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_idx" ON "Customer"("tenantId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Supplier
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Supplier" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Supplier" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "Supplier_nit_key";
CREATE UNIQUE INDEX "Supplier_tenantId_nit_key" ON "Supplier"("tenantId", "nit");
CREATE INDEX IF NOT EXISTS "Supplier_tenantId_idx" ON "Supplier"("tenantId");
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Sale" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Sale" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Sale_tenantId_idx" ON "Sale"("tenantId");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) Quote
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Quote" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Quote" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Quote_tenantId_idx" ON "Quote"("tenantId");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7) CashSession
ALTER TABLE "CashSession" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "CashSession" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "CashSession" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "CashSession_tenantId_idx" ON "CashSession"("tenantId");
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8) Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Expense" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Expense_tenantId_idx" ON "Expense"("tenantId");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9) InventoryMovement
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "InventoryMovement" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "InventoryMovement" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "InventoryMovement_tenantId_idx" ON "InventoryMovement"("tenantId");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10) PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "PurchaseOrder" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "PurchaseOrder_orderNumber_key";
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_orderNumber_key" ON "PurchaseOrder"("tenantId", "orderNumber");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 11) SupplierInvoice
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "SupplierInvoice" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "SupplierInvoice" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "SupplierInvoice_invoiceNumber_key";
CREATE UNIQUE INDEX "SupplierInvoice_tenantId_invoiceNumber_key" ON "SupplierInvoice"("tenantId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_tenantId_idx" ON "SupplierInvoice"("tenantId");
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 12) Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "Invoice" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "Invoice_number_key";
CREATE UNIQUE INDEX "Invoice_tenantId_number_key" ON "Invoice"("tenantId", "number");
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_idx" ON "Invoice"("tenantId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13) DianConfig (opcional: puede no haber filas; una por tenant)
ALTER TABLE "DianConfig" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "DianConfig" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "DianConfig" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "DianConfig_tenantId_key" ON "DianConfig"("tenantId");
CREATE INDEX IF NOT EXISTS "DianConfig_tenantId_idx" ON "DianConfig"("tenantId");
ALTER TABLE "DianConfig" ADD CONSTRAINT "DianConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 14) AuditLog (tenantId opcional para histórico)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "AuditLog" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 15) BackupRun
ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
UPDATE "BackupRun" SET "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'default' LIMIT 1) WHERE "tenantId" IS NULL;
ALTER TABLE "BackupRun" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "BackupRun_tenantId_idx" ON "BackupRun"("tenantId");
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
