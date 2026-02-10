-- Precio recurrente de Stripe asociado al plan (opcional)
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "stripePriceId" VARCHAR(255);
