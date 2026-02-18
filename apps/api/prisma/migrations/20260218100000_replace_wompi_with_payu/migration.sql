-- Replace WOMPI with PAYU in PaymentProvider enum.
-- If PaymentProvider does not exist, create it with STRIPE and PAYU and create Payment table.
-- If it exists (with WOMPI), add PAYU, update rows, and swap enum.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN
    CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYU');
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
      CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'REFUNDED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Payment') THEN
      CREATE TABLE "Payment" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
        "provider" "PaymentProvider" NOT NULL,
        "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
        "amount" DECIMAL(18,2) NOT NULL,
        "currency" VARCHAR(8) NOT NULL,
        "externalId" VARCHAR(255),
        "purpose" VARCHAR(100),
        "metadata" JSONB,
        "createdById" UUID,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");
      CREATE INDEX "Payment_provider_status_idx" ON "Payment"("provider", "status");
      CREATE INDEX "Payment_externalId_idx" ON "Payment"("externalId");
    END IF;
  ELSE
    ALTER TYPE "PaymentProvider" ADD VALUE 'PAYU';
    UPDATE "Payment" SET provider = 'PAYU' WHERE provider = 'WOMPI';
    CREATE TYPE "PaymentProvider_new" AS ENUM ('STRIPE', 'PAYU');
    ALTER TABLE "Payment" ALTER COLUMN provider TYPE "PaymentProvider_new" USING (
      CASE WHEN provider::text = 'WOMPI' THEN 'PAYU'::"PaymentProvider_new"
           ELSE provider::text::"PaymentProvider_new" END
    );
    DROP TYPE "PaymentProvider";
    ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
  END IF;
END $$;
