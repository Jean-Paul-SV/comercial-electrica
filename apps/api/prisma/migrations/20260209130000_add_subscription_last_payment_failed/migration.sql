-- Fecha del último pago fallido (Stripe). Si hay un segundo fallo dentro de 30 días, se suspende la suscripción y el tenant.
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lastPaymentFailedAt" TIMESTAMPTZ;
