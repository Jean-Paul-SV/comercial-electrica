-- Añadir campos para rastrear inconsistencias entre BD y Stripe
-- C1.1: Transacciones atómicas Stripe-BD - Patrón de compensación

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "needsStripeSync" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeSyncError" TEXT;

-- Índice para job de reconciliación que busca suscripciones desincronizadas
CREATE INDEX IF NOT EXISTS "Subscription_needsStripeSync_idx" ON "Subscription"("needsStripeSync");
