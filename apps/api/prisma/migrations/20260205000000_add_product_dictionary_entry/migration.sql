-- CreateTable
CREATE TABLE "ProductDictionaryEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "term" VARCHAR(200) NOT NULL,
    "productId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDictionaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductDictionaryEntry_tenantId_idx" ON "ProductDictionaryEntry"("tenantId");

-- CreateIndex
CREATE INDEX "ProductDictionaryEntry_term_idx" ON "ProductDictionaryEntry"("term");

-- CreateIndex
CREATE INDEX "ProductDictionaryEntry_productId_idx" ON "ProductDictionaryEntry"("productId");

-- AddForeignKey
ALTER TABLE "ProductDictionaryEntry" ADD CONSTRAINT "ProductDictionaryEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDictionaryEntry" ADD CONSTRAINT "ProductDictionaryEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
